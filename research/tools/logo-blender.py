"""
The Pocket Wind Tunnel — logo build script for Blender 5.x (headless)
=====================================================================
A NACA 2412 section, extruded as a gunmetal slab, inside a glowing cyan tunnel ring, with streamlines that were
computed by the tool's own Hess–Smith panel method (research/tools/logo-geometry.json). Studio treatment:
Cycles, soft neutral world, cyan emissive glyph, in light and dark variants.

  "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" -b -P logo-blender.py -- [light|dark|icon|all] [samples]

Outputs research/tools/logo/: pwt-logo-3d.png (light studio, 2000×1000), pwt-logo-3d-dark.png, pwt-logo-mark-3d.png
(1200², transparent, mark only), pwt-logo.blend
"""
import bpy, bmesh, json, math, os, sys
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
GEO = json.load(open(os.path.join(HERE, 'logo-geometry.json'), encoding='utf-8'))
OUT = os.path.join(HERE, 'logo'); os.makedirs(OUT, exist_ok=True)
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
WHICH = argv[0] if argv else 'all'; SAMPLES = int(argv[1]) if len(argv) > 1 else 128

CYAN = (0.16, 0.72, 0.92)
GUN = (0.050, 0.062, 0.080)
RING_R, RING_T = 1.62, 0.030          # tunnel ring: major / minor radius
CX = 0.45                              # ring centre x (the section sits slightly forward of centre)
TEXT_X = CX + RING_R + 0.75            # wordmark starts here (left-aligned), two lines


def clean():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name, base, metallic=0.0, rough=0.5, emit=None, strength=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (*base, 1.0)
    p.inputs["Metallic"].default_value = metallic
    p.inputs["Roughness"].default_value = rough
    if emit is not None:
        p.inputs["Emission Color"].default_value = (*emit, 1.0)
        p.inputs["Emission Strength"].default_value = strength
    return m


def smooth(o, angle=math.radians(35)):
    o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.shade_smooth()
    try: bpy.ops.object.shade_auto_smooth(angle=angle)
    except Exception: pass
    o.select_set(False)


def build_airfoil(m):
    pts = GEO['airfoil'][:-1]
    depth = 0.22
    bm = bmesh.new()
    bot = [bm.verts.new((x, -depth / 2, y)) for x, y in pts]
    top = [bm.verts.new((x, depth / 2, y)) for x, y in pts]
    n = len(pts)
    bm.faces.new(bot[::-1]); bm.faces.new(top)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((bot[i], bot[j], top[j], top[i]))
    bm.normal_update()
    me = bpy.data.meshes.new("Airfoil"); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new("Airfoil", me); bpy.context.collection.objects.link(o)
    o.data.materials.append(m)
    bev = o.modifiers.new("Bevel", 'BEVEL'); bev.width = 0.014; bev.segments = 5; bev.limit_method = 'ANGLE'; bev.angle_limit = math.radians(30)
    smooth(o)
    return o


def build_ring(m_glow, m_metal):
    bpy.ops.mesh.primitive_torus_add(major_radius=RING_R, minor_radius=RING_T, major_segments=192, minor_segments=24, location=(CX, 0, 0), rotation=(math.radians(90), 0, 0))
    o = bpy.context.active_object; o.name = "TunnelRing"; o.data.materials.append(m_glow); smooth(o)
    bpy.ops.mesh.primitive_torus_add(major_radius=RING_R + 0.075, minor_radius=0.016, major_segments=192, minor_segments=12, location=(CX, 0, 0), rotation=(math.radians(90), 0, 0))
    o2 = bpy.context.active_object; o2.name = "OuterRing"; o2.data.materials.append(m_metal); smooth(o2)


def build_streamlines(m_glow):
    rmax = RING_R - 0.06
    for si, line in enumerate(GEO['streamlines']):
        pts = [(x, 0.0, y) for x, y in line if (x - CX) ** 2 + y ** 2 < rmax ** 2]
        if len(pts) < 4: continue
        cu = bpy.data.curves.new(f"Stream{si}", 'CURVE'); cu.dimensions = '3D'
        sp = cu.splines.new('NURBS'); sp.points.add(len(pts) - 1)
        for p, (x, y, z) in zip(sp.points, pts): p.co = (x, y, z, 1.0)
        sp.use_endpoint_u = True; sp.order_u = 4
        cu.bevel_depth = 0.012; cu.bevel_resolution = 6; cu.use_fill_caps = True
        o = bpy.data.objects.new(f"Stream{si}", cu); bpy.context.collection.objects.link(o)
        o.data.materials.append(m_glow)


def build_text(m, m_small):
    def line(body, size, z, m_, space=1.1):
        bpy.ops.object.text_add(location=(TEXT_X, 0.0, z))
        t = bpy.context.active_object; t.name = "Word_" + body.replace(' ', '_')
        t.data.body = body; t.data.align_x = 'LEFT'; t.data.size = size; t.data.extrude = 0.045; t.data.bevel_depth = 0.007; t.data.bevel_resolution = 3
        t.data.space_character = space
        t.rotation_euler = (math.radians(90), 0, 0)
        t.data.materials.append(m_); smooth(t, math.radians(60))
        return t
    line("THE", 0.22, 0.78, m_small, 1.35)
    line("POCKET", 0.62, 0.12, m)
    line("WIND TUNNEL", 0.62, -0.60, m)


def studio(dark, with_text):
    sc = bpy.context.scene
    floor_z = -RING_R - 0.12
    if dark:
        g_col, b_col, w_col, w_str = (0.012, 0.015, 0.020), (0.010, 0.013, 0.018), (0.30, 0.40, 0.55), 0.05
    else:
        g_col, b_col, w_col, w_str = (0.34, 0.37, 0.41), (0.50, 0.54, 0.60), (0.78, 0.80, 0.84), 0.20
    bpy.ops.mesh.primitive_plane_add(size=80, location=(CX + 2.5, 0, floor_z))
    g = bpy.context.active_object; g.name = "Ground"; g.data.materials.append(mat("Ground", g_col, 0.0, 0.28 if dark else 0.45))
    bpy.ops.mesh.primitive_plane_add(size=80, location=(CX + 2.5, 7.0, 0), rotation=(math.radians(90), 0, 0))
    b = bpy.context.active_object; b.name = "Backdrop"; b.data.materials.append(mat("Backdrop", b_col, 0.0, 0.7))
    world = bpy.data.worlds.new("W"); sc.world = world; world.use_nodes = True
    bg = world.node_tree.nodes["Background"]; bg.inputs[0].default_value = (*w_col, 1); bg.inputs[1].default_value = w_str
    target = (CX + (2.6 if with_text else 0.0), 0, -0.2)

    def area(name, loc, energy, size, color=(1, 1, 1)):
        bpy.ops.object.light_add(type='AREA', location=loc)
        L = bpy.context.active_object; L.name = name; L.data.energy = energy; L.data.size = size; L.data.color = color
        d = Vector(target) - Vector(loc); L.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    k = 0.55 if dark else 1.0
    area("Key", (CX - 3.0, -6.0, 4.0), 1600 * k, 4.0)
    area("Fill", (CX + 7.0, -6.0, 1.0), 500 * k, 5.0, color=(0.85, 0.92, 1.0))
    area("Rim", (CX + 2.0, 4.0, 3.0), 900 * k, 2.5, color=(0.75, 0.9, 1.0))
    area("Top", (CX + 2.5, -1.5, 6.0), 350 * k, 6.0)


def camera(kind):
    sc = bpy.context.scene
    if kind == 'lockup':
        loc, aim, lens = (CX + 3.4, -14.6, 1.7), (CX + 2.75, 0, -0.1), 50
    else:
        loc, aim, lens = (CX, -8.0, 0.0), (CX, 0, 0.0), 70
    bpy.ops.object.camera_add(location=loc)
    cam = bpy.context.active_object; cam.name = "Cam_" + kind; cam.data.lens = lens
    d = Vector(aim) - Vector(loc); cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    sc.camera = cam


def compositor_glow():
    sc = bpy.context.scene
    try:
        if hasattr(sc, 'compositing_node_group'):
            tree = bpy.data.node_groups.new("PWT_Comp", 'CompositorNodeTree'); sc.compositing_node_group = tree
        else:
            sc.use_nodes = True; tree = sc.node_tree
        for n in list(tree.nodes): tree.nodes.remove(n)
        rl = tree.nodes.new('CompositorNodeRLayers'); gl = tree.nodes.new('CompositorNodeGlare')
        try: comp = tree.nodes.new('CompositorNodeComposite')
        except Exception:
            tree.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor'); comp = tree.nodes.new('NodeGroupOutput')
        for attr, val in (('glare_type', 'BLOOM'), ('threshold', 1.0), ('mix', 0.0), ('size', 7), ('quality', 'HIGH')):
            try:
                if hasattr(gl, attr): setattr(gl, attr, val)
            except Exception: pass
        for name, val in (('Type', 'Bloom'), ('Threshold', 1.0), ('Strength', 0.18), ('Size', 0.6), ('Mix', 0.0)):
            try:
                if name in gl.inputs: gl.inputs[name].default_value = val
            except Exception: pass
        tree.links.new(rl.outputs['Image'], gl.inputs['Image']); tree.links.new(gl.outputs['Image'], comp.inputs['Image'])
        print("compositor glare:", [s.name for s in gl.inputs])
    except Exception as e:
        print("compositor unavailable, rendering without bloom:", e)
        try: sc.compositing_node_group = None
        except Exception: pass


def render(path, w, h, transparent):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = SAMPLES
    sc.cycles.use_denoising = True
    sc.render.resolution_x = w; sc.render.resolution_y = h; sc.render.resolution_percentage = 100
    sc.render.film_transparent = transparent
    sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA' if transparent else 'RGB'
    try: sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium Contrast'
    except Exception: pass
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("RENDERED", path)


def build(dark, with_text):
    clean()
    m_gun = mat("Gunmetal", GUN, 0.92, 0.30)
    m_line = mat("CyanGlow", CYAN, 0.0, 0.4, emit=CYAN, strength=3.0 if dark else 2.2)
    m_ring = mat("RingGlow", CYAN, 0.0, 0.35, emit=CYAN, strength=2.2 if dark else 1.6)
    m_metal = mat("RingMetal", (0.45, 0.48, 0.53), 1.0, 0.30)
    m_text = mat("TextMetal", (0.80, 0.84, 0.90) if not dark else (0.86, 0.90, 0.95), 1.0, 0.26)
    m_small = mat("TextCyan", CYAN, 0.0, 0.4, emit=CYAN, strength=1.6)
    build_airfoil(m_gun); build_ring(m_ring, m_metal); build_streamlines(m_line)
    if with_text: build_text(m_text, m_small)
    if with_text or not transparent_icon: studio(dark, with_text)
    compositor_glow()


transparent_icon = False
if WHICH in ('light', 'all'):
    build(False, True); camera('lockup'); render(os.path.join(OUT, 'pwt-logo-3d.png'), 2000, 1000, False)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'pwt-logo.blend'))
if WHICH in ('dark', 'all'):
    build(True, True); camera('lockup'); render(os.path.join(OUT, 'pwt-logo-3d-dark.png'), 2000, 1000, False)
if WHICH in ('icon', 'all'):
    transparent_icon = True
    build(True, False)
    # mark only, lit but with no ground/backdrop → transparent background
    def area(name, loc, energy, size):
        bpy.ops.object.light_add(type='AREA', location=loc); L = bpy.context.active_object; L.name = name; L.data.energy = energy; L.data.size = size
        d = Vector((CX, 0, 0)) - Vector(loc); L.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    area("Key", (CX - 3, -5, 3), 900, 3); area("Fill", (CX + 4, -5, 0), 350, 4)
    camera('icon'); render(os.path.join(OUT, 'pwt-logo-mark-3d.png'), 1200, 1200, True)
