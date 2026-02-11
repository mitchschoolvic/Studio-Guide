export interface Vector2 {
    x: number;
    y: number;
}

export class VectorPool {
    private static pool: Vector2[] = [];
    private static readonly MAX_POOL_SIZE = 200;

    /**
     * Get a cleared Vector2 from the pool or create a new one
     */
    static get(): Vector2 {
        if (this.pool.length > 0) {
            const v = this.pool.pop()!;
            v.x = 0;
            v.y = 0;
            return v;
        }
        return { x: 0, y: 0 };
    }

    /**
     * Return a Vector2 to the pool
     */
    static release(v: Vector2) {
        if (this.pool.length < this.MAX_POOL_SIZE) {
            this.pool.push(v);
        }
    }
}
