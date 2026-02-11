/**
 * One Euro Filter for jitter reduction
 * Port of backend/app/utils/filters.py
 */

export class OneEuroFilter {
    minCutoff: number;
    beta: number;
    dCutoff: number;
    xPrev: number;
    dxPrev: number;
    tPrev: number;

    constructor(
        t0: number, 
        x0: number, 
        minCutoff = 1.0, 
        beta = 0.0, 
        dCutoff = 1.0
    ) {
        this.minCutoff = minCutoff;
        this.beta = beta;
        this.dCutoff = dCutoff;
        this.xPrev = x0;
        this.dxPrev = 0.0;
        this.tPrev = t0;
    }

    smoothingFactor(t_e: number, cutoff: number): number {
        const r = 2 * Math.PI * cutoff * t_e;
        return r / (r + 1);
    }

    exponentialSmoothing(a: number, x: number, x_prev: number): number {
        return a * x + (1 - a) * x_prev;
    }

    filter(t: number, x: number): number {
        const t_e = t - this.tPrev;
        
        // If time hasn't advanced, return previous value
        if (t_e <= 0) return this.xPrev;

        const a_d = this.smoothingFactor(t_e, this.dCutoff);
        const dx = (x - this.xPrev) / t_e;
        const dx_hat = this.exponentialSmoothing(a_d, dx, this.dxPrev);

        const cutoff = this.minCutoff + this.beta * Math.abs(dx_hat);
        const a = this.smoothingFactor(t_e, cutoff);
        const x_hat = this.exponentialSmoothing(a, x, this.xPrev);

        this.xPrev = x_hat;
        this.dxPrev = dx_hat;
        this.tPrev = t;
        
        return x_hat;
    }
}