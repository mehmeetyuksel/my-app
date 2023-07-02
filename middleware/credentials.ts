import { allowedOrigins } from "../config/allowedOrigins"
import { Request, Response, NextFunction } from 'express';

export const credential = (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin!
    if(allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000')
        res.setHeader('Access-Control-Allow-Credentials', 'true')
    }
    next()
}