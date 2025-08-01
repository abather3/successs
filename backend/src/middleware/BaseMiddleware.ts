import { Request, Response, NextFunction } from 'express';

export abstract class Middleware {
  abstract execute(req: Request, res: Response, next: NextFunction): void;

  handle(): (req: Request, res: Response, next: NextFunction) => void {
    return (req, res, next) => this.execute(req, res, next);
  }
}

// Example usage
export class ExampleMiddleware extends Middleware {
  execute(req: Request, res: Response, next: NextFunction): void {
    // Your logic here
    console.log('Middleware triggered');
    next();
  }
}
