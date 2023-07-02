import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand, DynamoDBDocumentClient, GetCommand, UpdateCommand, DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import verifyJwt from "./middleware/verifyJwt";
import router from "./routes/api"
import bcrypt from "bcrypt"
import cors from "cors"
var cookieParser = require('cookie-parser')
import { handleRefreshToken } from './routes/refreshToken';
import { corsOptions } from './config/corsOptions';
import { credential } from './middleware/credentials';
const { v4: uuidv4 } = require('uuid');
const client = new DynamoDBClient({});
const marshallOptions = {
    // Whether to automatically convert empty strings, blobs, and sets to `null`.
    convertEmptyValues: false, // false, by default.
    // Whether to remove undefined values while marshalling.
    removeUndefinedValues: true, // false, by default.
    // Whether to convert typeof object to map attribute.
    convertClassInstanceToMap: false, // false, by default.
};

const unmarshallOptions = {
    // Whether to return numbers as a string instead of converting them to native JavaScript numbers.
    wrapNumbers: false, // false, by default.
};

const translateConfig = { marshallOptions, unmarshallOptions };
const ddbDocClient = DynamoDBDocument.from(client, translateConfig);
const jwt = require('jsonwebtoken');
dotenv.config();

const app: Express = express();
const port = process.env.PORT;
app.use(cookieParser())
app.use(credential)
app.use(cors(corsOptions))
app.use(express.json())
app.post('/sign-up', async (req: Request, res: Response) => {
    const { email, password, name, surname } = req.body
    let hashedPass = await bcrypt.hash(password, 11)

    const checkIsEmailExist = new GetCommand({
        TableName: "Users",
        Key: {
            email
        }
    });
    const checkIsEmailExistResponse = await ddbDocClient.send(checkIsEmailExist);

    if (checkIsEmailExistResponse.Item) return res.status(400).send({ message: 'Bu email zaten kullanımda!' })

    let _id = uuidv4()

    const UsersCommand = new PutCommand({
        TableName: "Users",
        Item: {
            email,
            password: hashedPass,
            _id,
            name,
            surname
        },
    });
    const UserCommand = new PutCommand({
        TableName: "User",
        Item: {
            _id,
            email,
            name,
            surname,
            posts: []
        },
    });
    const response = await ddbDocClient.send(UsersCommand);
    await ddbDocClient.send(UserCommand);
    res.status(200).json({
        message: "Kullanıcı başarıyla eklendi",
        ...response
    });
})

app.post('/log-in', async (req: Request, res: Response) => {

    const { email, password } = req.body

    if (!email || !password) res.status(400).json({
        message: 'Email ve Parola gerekli!'
    })

    const checkIsEmailExist = new GetCommand({
        TableName: "Users",
        Key: {
            email
        }
    });
    const user = await ddbDocClient.send(checkIsEmailExist)

    if (!user.Item) return res.status(400).json({
        message: 'Bu email ile ilişkili hesap bulunamadı.'
    })

    let isPasswordTrue = await bcrypt.compare(password, user.Item.password)

    if (!isPasswordTrue) return res.status(403).json({
        message: 'Hatalı parola!'
    })

    const accessToken = jwt.sign({
        email: user.Item.email,
        name: user.Item.name,
        surname: user.Item.surname,
        _id: user.Item._id,
    }, process.env.ACCESS_SECRET_KEY, { expiresIn: '5m' })

    const refreshToken = jwt.sign({
        email: user.Item.email,
        name: user.Item.name,
        surname: user.Item.surname,
        _id: user.Item._id,
    }, process.env.REFRESH_SECRET_KEY, { expiresIn: '1d' })

    const command = new UpdateCommand({
        TableName: "Users",
        Key: {
            email: user.Item.email
        },
        UpdateExpression: "set refreshToken = :refreshToken",
        ExpressionAttributeValues: {
            ":refreshToken": refreshToken,
        },
        ReturnValues: "ALL_NEW",
    });

    await ddbDocClient.send(command);

    res.cookie('jwt', refreshToken, {httpOnly: true, maxAge: 24 * 60 * 60 * 1000, secure: true, sameSite: 'none', path: '/login'})

    res.status(200).json({
        user: {
            email: user.Item.email,
            name: user.Item.name,
            surname: user.Item.surname,
            _id: user.Item._id,
        },
        accessToken,
    })

})
app.get("/refresh", handleRefreshToken)
app.use(verifyJwt)
app.use("/api", router)

app.listen(port, () => {
    console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
});