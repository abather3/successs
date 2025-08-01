import { Request, Response, NextFunction } from 'express';
export declare abstract class Middleware {
    abstract execute(req: Request, res: Response, next: NextFunction): void;
    handle(): (req: Request, res: Response, next: NextFunction) => void;
}
export declare class ExampleMiddleware extends Middleware {
    execute(req: Request, res: Response, next: NextFunction): void;
}
//# sourceMappingURL=BaseMiddleware.d.ts.map