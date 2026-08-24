# The next machine — specification and buying notes

**Date:** 2026-08-24 · **Purpose:** choose second-hand hardware for the stage of NSLab after NS-004.
**Status:** advisory. Nothing bought. All prices are August 2026 UK used-market observations, not quotes.

---

## 1. The measured wall

The current machine is a laptop: Ryzen 9 5900HX, **RTX 3060 Laptop 6 GB**, driver 610.62. Two numbers from the
archive define the limit exactly.

| Run | Precision | Peak device memory | Cost |
|---|---|---|---|
| `tubes-Re2000-N320-fp32-gpu` | float32 | 6.13 GB | 1.29 h to t = 16 (1.27 s/step) |
| `tubes-Re2000-N384-gpu` (bench only) | float32 | **6.44 GB — card full** | **14 934 ms/step → 12.9 h projected** |

The 384³ step time is **6.6× worse than the N³·log N scaling predicts** (2.3 s/step expected). That gap is not
computation, it is the driver spilling to host memory over PCIe. 384³ did not run; it was benched and abandoned.
The same wall is why NS-003b's float64 ladder stopped at 256³ (5.98 GB) and why the report records the
fp64 288³ upgrade route as blocked.

## 2. Memory model

Fitted from five archived runs (192³/256³ fp64, 192³/288³/320³ fp32), `memGetInfo` total − free:

```
float32 ≈ 153 bytes/point + 1.1 GB      float64 ≈ 287 bytes/point + 1.15 GB
```

The constant includes the Windows desktop's share, so these are slightly pessimistic for a dedicated card.
Cross-check: the model gives fp64 288³ = 8.0 GB, consistent with the report's own "needs ≥ 12 GB card".

| N | float32 | float64 | Fits in 12 GB | 16 GB | **24 GB** | 32 GB | 48 GB |
|---|---|---|---|---|---|---|---|
| 320³ | 6.1 GB | 10.6 GB | fp64 | fp64 | fp64 | fp64 | fp64 |
| 384³ | 9.8 GB | **17.4 GB** | fp32 | fp32 only | **fp64** | fp64 | fp64 |
| 448³ | 14.9 GB | 27.0 GB | — | fp32 | fp32 | **fp64** | fp64 |
| 512³ | **21.6 GB** | 39.7 GB | — | — | **fp32 (tight)** | fp32 | **fp64** |
| 576³ | 30.4 GB | 56.0 GB | — | — | — | fp32 | fp32 |
| 640³ | 41.2 GB | 76.4 GB | — | — | — | — | fp32 |

**16 GB is the cruel tier.** float64 384³ needs 17.4 GB and misses a 16 GB card by 1.4 GB. Every 16 GB option
(RTX 4060 Ti 16 GB, RTX A4000, Tesla V100 16 GB) buys a big step in float32 and *nothing* in the precision the
evidence archive actually admits. Do not buy 16 GB.

**24 GB is the target.** It delivers float64 to ~416³ and float32 to 512³ — two rungs past where NS-003b stopped
in each precision.

## 3. Projected wall-clock on a 24 GB RTX 3090

Scaled from the measured 320³ point by N³·log N, times the 3090's 2.8× memory bandwidth (936 vs 336 GB/s), times
the measured float64 penalty of 4.2× (not the theoretical 64× — the FFTs are only partly compute-bound).

| Run to t = 16 | 3060 Laptop 6 GB | RTX 3090 24 GB |
|---|---|---|
| 384³ float32 | impossible (12.9 h, thrashing) | **≈ 0.9 h** |
| 384³ float64 | impossible (17.4 GB) | **≈ 3.7 h** |
| 416³ float64 | impossible | ≈ 5.0 h |
| 512³ float32 | impossible | ≈ 2.9 h |

Everything that is currently impossible becomes an overnight run. That is the whole case for the purchase.

## 4. Specification

### Non-negotiable

- **GPU: 24 GB NVIDIA.** RTX 3090 (best value), RTX 3090 Ti, RTX 4090 (≈ 2× faster, ≈ £500 more), RTX A5000.
  Must be NVIDIA — the runner is CuPy/cuFFT.
- **PSU: 850 W or more, 80+ Gold, from a named brand**, with 3× 8-pin PCIe. The 3090's transient spikes trip
  650 W units. This is the component second-hand sellers skimp on; verify the make and model, not the sticker.
- **CPU with integrated graphics.** Run the desktop off the iGPU and leave all 24 GB to CUDA — 512³ float32 at
  21.6 GB does not otherwise fit. **Avoid Intel "F" parts and non-G Ryzen 5000**, which have no iGPU.
  Good: i7-12700K / i7-13700K / i9-12900K, Ryzen 7 7700X / 9 7900X.
- **RAM ≥ 64 GB.** Checkpoints round-trip through host memory; a 512³ float64 `checkpoint.npz` is 3.2 GB.
- **Storage: 2 TB NVMe.** Run folders carry slices and repeated checkpoints.

### Strongly preferred

- Case with ≥ 330 mm GPU clearance, 3 slots, and real front intake. These are unattended 100 % runs for hours —
  a mining duty cycle, in a domestic room.
- A second PCIe x16 slot, for a later compute card (§5, route 3).
- **Windows 11**, to keep the existing toolchain unchanged: the PowerShell detached launchers, `run-ns004.ps1`,
  the puppeteer-core + local Chrome screenshot recipe, and the Ollama install.

### Deliberately not required

Fast float64 silicon. The measured float64:float32 ratio on this workload is **4.2×, not 64×** — the pseudo-spectral
step is bandwidth-heavy, not FLOP-heavy. Chasing 1:2 float64 cards (P100, V100) at the cost of capacity is the wrong
trade for the first purchase. Capacity first, bandwidth second, float64 rate third.

## 5. Routes and budgets

| # | Route | Cost | Verdict |
|---|---|---|---|
| 1 | Used tower with RTX 3090 already in it | £1000–1500 | **Recommended.** One transaction, one risk. |
| 1b | Ex-lease workstation (£250–400) + used 3090 (£750–900) + PSU | £1050–1350 | Better components, three transactions, PSU/clearance risk. |
| 2 | Used tower with RTX 4090 | £1600–2200 | Buy only if the extra £600 is painless. Same 24 GB ceiling. |
| 3 | Later: add a Tesla V100 32 GB PCIe as a headless second card | +£500–900 | The float64 specialist — 1:2 rate, 32 GB → float64 448³. Passive cooling, no display output, needs a shroud and a data-centre driver. A project, not a first purchase. |
| — | RTX A6000 48 GB | £4000+ | Out of scope at current used prices. |

**Rejected:** Tesla P40 24 GB (cheap, but 347 GB/s ≈ the current laptop's bandwidth — it buys capacity and no speed);
anything 16 GB (§2); AMD (no CuPy/cuFFT path).

### Worth doing before spending anything

One night of a rented A100 80 GB (~£1/h on the usual GPU-rental markets) runs the float64 448³ and 512³ rungs for
about £30. If the pointwise peak has genuinely converged at ≈ 130 and the higher rungs add nothing, that is a £1200
purchase avoided; if it moves, the purchase is justified by measurement rather than by hope. The offline,
zero-dependency rule binds the single-file HTML deliverable, not the batch research layer — this is allowed by the
existing precision policy, and the code contains nothing sensitive.

## 6. Acceptance test

Take a USB stick. On any candidate machine, install the wheels and run:

```
python gpu/nslab_gpu.py --N 384 --ic tubes --bench
```

- **float64 (default) must allocate at all** — 17.4 GB. A 16 GB card fails here; that is the test.
- Peak device memory should report ≈ 17–18 GB.
- Step time should be **well under 3000 ms**. The current laptop reports **14 934 ms/step in float32** at this size.
  A 24 GB card that is not spilling should be 40–60× faster in wall-clock on the same command.

If the seller will not allow this, run FurMark for ten minutes and watch for artefacts.

## 7. Seller checklist

- Photo of **GPU-Z or `nvidia-smi -q`** showing the exact card, 24 GB, and board power.
- **Memory-junction temperature under load** from HWiNFO. GDDR6X on a 3090 above ~100 °C means the thermal pads
  are finished — a £30 fix, but a £100 bargaining point.
- Have the pads already been replaced? On a 3090 this is a good sign, not a bad one.
- **PSU make, model and wattage** — reject unbranded units and anything under 850 W regardless of the claim.
- Ex-corporate workstations: confirm **no BIOS or admin password lock**, and that the PSU has the PCIe cables
  (Dell and HP use proprietary pinouts — a proprietary PSU cannot power a 3090 without an adapter).
- Ex-mining cards are not automatically bad (undervolted, thermally steady) but the memory has run hot for years.
  Price accordingly; insist on the temperature reading above.
- Collection in person, tested, beats posted every time. A 3090 damaged in transit is a £750 argument.

## 8. Search pastes

eBay supports `(a,b,c)` as OR and `-(a,b,c)` as NOT. Gumtree and Facebook Marketplace support neither — use the
plain phrase list. Paste verbatim.

**A — whole desktop with a 24 GB card (primary sweep)**

```
(3090,4090) (pc,desktop,tower,rig,system) -(laptop,notebook,shroud,backplate,waterblock,heatsink,bracket,riser,cable,sticker,poster,empty,barebones,faulty,spares,repair,parts)
```

**B — same, widened to workstation cards and sellers who omit "PC"**

```
(3090,4090,a5000,3090ti) (gaming,workstation,i7,i9,ryzen,5900x,5950x,12700,13700,7900x) -(laptop,notebook,shroud,backplate,waterblock,bracket,riser,sticker,faulty,spares,repair,parts)
```

**C — card only, to fit into a cheap chassis (route 1b)**

```
(3090,3090ti,4090,a5000) 24gb -(laptop,shroud,backplate,waterblock,heatsink,bracket,riser,cable,sticker,poster,empty,faulty,spares,repair,parts,fan,cooler,mount)
```

**D — ex-lease workstation chassis to host it (route 1b)**

```
(precision,thinkstation,workstation) (7820,5820,t7910,t7810,p520,p720,z4,z6,z8) -(laptop,mobile,rail,rails,bezel,cover,caddy,motherboard,heatsink,parts,spares,faulty)
```

**E — float64 specialist, later (route 3)**

```
(v100,a100) (32gb,pcie) -(sxm2,sxm4,carrier,board,riser,bracket,heatsink,adapter,cable)
```

**eBay filters to set after pasting:** Condition = Used · Item Location = UK Only · Buying Format = Buy It Now
(then repeat with Auction) · Sort = Price + Postage: lowest · for A/B/D set Category = Computers/Tablets &
Networking → Desktops & All-In-Ones. Save each as a saved search with email alerts — the good ones sell in hours.

**F — Gumtree / Facebook Marketplace / CeX (no boolean; run each term separately)**

```
RTX 3090 PC
3090 gaming PC
RTX 3090 desktop
RTX 4090 PC
24GB gaming PC
RTX 3090
workstation PC 3090
```

On Marketplace, set radius to 40 miles and sort by newest — collection in person is the point (§7).
