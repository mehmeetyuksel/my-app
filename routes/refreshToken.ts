import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { Request, Response } from 'express';
const jwt = require('jsonwebtoken');
import dotenv from 'dotenv';
dotenv.config();
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
export const handleRefreshToken = async (req: Request, res: Response) => {
    const { cookies } = req
    if (!cookies.jwt) return res.status(401).send({message :'Cookies içerisinde JWT bulunamadı!'})
    let refreshToken = cookies.jwt
    const command = new ScanCommand({
        FilterExpression:'refreshToken = :rt',
        ExpressionAttributeValues:{
            ':rt': {'S': refreshToken}
        },
        TableName: "Users",
      });
    
    const user = await docClient.send(command)
    if (!user.Items?.length) return res.status(403).json({
        message: 'Bu refresh token ile ilişkili hesap bulunamadı.'
    })

    jwt.verify(refreshToken, process.env.REFRESH_SECRET_KEY, (err: any, decoded: any) => {
        if(err || !user.Items![0]) return res.status(403).send({message: err})
        const accessToken = jwt.sign({
            email: decoded.email,
            name: decoded.name,
            surname: decoded.surname,
            _id: decoded._id,
        }, process.env.ACCESS_SECRET_KEY, { expiresIn: '5m' })
        res.json({
            ...decoded,
            accessToken})
        })
}

  
  