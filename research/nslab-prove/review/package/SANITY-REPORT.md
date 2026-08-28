# Stage 6 numerical sanity report

Route: float64 composite Gauss-Legendre (24 nodes/panel, 4000 panels to R = 4000*pi) on the
defining oscillatory integral; numpy eigvalsh on B^(-1/2)AB^(-1/2); Galerkin K = [16, 20, 24].
No closed forms, no special functions, no interval arithmetic, no prover/auditor code.

Known non-rigorous error sources: quadrature truncation ~1/(4R^2) ~ 1.6e-09; float64
roundoff; Galerkin truncation (from below - the K-ladder above shows its size).

    K = 16 : 0.289567435  0.150850006  0.102195064
    K = 20 : 0.289570672  0.150854554  0.102200476
    K = 24 : 0.289572299  0.150856871  0.102203253

lambda_1 = 0.289572299  vs  [0.2895674, 0.2895979]  -> INSIDE (margin 4.86e-06)
lambda_2 = 0.150856871  vs  [0.1508500, 0.1509279]  -> INSIDE (margin 6.86e-06)
lambda_3 = 0.102203253  vs  [0.1021951, 0.1028375]  -> INSIDE (margin 8.19e-06)

VERDICT: PASS — failed to falsify

The one-way valve: this layer reads the certificate and writes only this report. It can
stop the project; it can never repair the certificate.
