import { NextFunction, Request, Response } from "express";

const jwt = require('jsonwebtoken');

const verifyJwt = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ message: 'Token bulunamadı!' })
    const token = authHeader.split(' ')[1]
    jwt.verify(token, process.env.ACCESS_SECRET_KEY, (err: any, decoded: any) => {
        if(err) return res.status(401).json({ message: 'Yetki hatası! Token geçersiz.' })
        req.user = decoded
        next()
    }) 
}
export default verifyJwt