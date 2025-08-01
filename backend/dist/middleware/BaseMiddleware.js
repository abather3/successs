"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExampleMiddleware = exports.Middleware = void 0;
class Middleware {
    handle() {
        return (req, res, next) => this.execute(req, res, next);
    }
}
exports.Middleware = Middleware;
// Example usage
class ExampleMiddleware extends Middleware {
    execute(req, res, next) {
        // Your logic here
        console.log('Middleware triggered');
        next();
    }
}
exports.ExampleMiddleware = ExampleMiddleware;
//# sourceMappingURL=BaseMiddleware.js.map