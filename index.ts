import express, { Express } from 'express';
import dotenv from 'dotenv';
import verifyJwt from "./middleware/verifyJwt";
import router from "./routes/api"
import cors from "cors"
import cookieParser from 'cookie-parser'
import { handleRefreshToken } from './routes/refreshToken';
import { corsOptions } from './config/corsOptions';
import { credential } from './middleware/credentials';
import { login, signUp } from './routes/user/user';

dotenv.config();

const app: Express = express();
const port = process.env.PORT;
app.use(cookieParser())
app.use(credential)
app.use(cors(corsOptions))
app.use(express.json())
app.post('/sign-up', signUp)

app.post('/log-in', login )
app.get("/refresh", handleRefreshToken)
app.use(verifyJwt)
app.use("/api", router)

app.listen(port, () => {
    console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
});