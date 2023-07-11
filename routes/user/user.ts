import { CreateTableCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import express, { Request, Response } from 'express';
import { DynamoDBDocument, GetCommand, UpdateCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import bcrypt from "bcrypt"

const router = express.Router();
const jwt = require('jsonwebtoken');

const { v4: uuidv4 } = require('uuid');
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

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocument.from(client, translateConfig);

router.post('/create-table', async (req: Request, res: Response) => {
  const command = new CreateTableCommand({
    TableName: "User",
    // For more information about data types,
    // see https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.NamingRulesDataTypes.html#HowItWorks.DataTypes and
    // https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Programming.LowLevelAPI.html#Programming.LowLevelAPI.DataTypeDescriptors
    AttributeDefinitions: [
      {
        AttributeName: "_id",
        AttributeType: "S",
      },
    ],
    KeySchema: [
      {
        AttributeName: "_id",
        KeyType: "HASH",
      },
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 1,
      WriteCapacityUnits: 1,
    },
  });

  const response = await client.send(command);
  res.status(200).json({ response })
})

router.post('/add-post', async (req: Request, res: Response) => {

  const getCommand = new GetCommand({
    TableName: "User",
    Key: {
      _id: req.user!._id
    }
  });
  const user = await ddbDocClient.send(getCommand);
  const userPosts = user.Item!?.posts.length > 0 ? user.Item!.posts : []
  const newPost = {
    post: req.body.post,
    id: uuidv4(),
    createdAt: Date.now()
  }
  const command = new UpdateCommand({
    TableName: "User",
    Key: {
      _id: req.user!._id
    },
    UpdateExpression: "set posts = :post",
    ExpressionAttributeValues: {
      ":post": [...userPosts, newPost],
    },
    ReturnValues: "ALL_NEW",
  });
  const response = await ddbDocClient.send(command);
  res.status(200).json({
    message: 'Başarılı!',
    response
  })
})

router.get('/get-posts', async (req: Request, res: Response) => {
  const command = new GetCommand({
    TableName: "User",
    Key: {
      _id: req.user!._id
    },
    ProjectionExpression: 'posts'
  });

  const response = await ddbDocClient.send(command);
  res.status(200).json({
    message: 'Başarılı!',
    posts: response.Item!.posts
  })
})

router.post('/remove-post', async (req: Request, res: Response) => {

  const getCommand = new GetCommand({
    TableName: "User",
    Key: {
      _id: req.user!._id
    }
  });
  const user = await ddbDocClient.send(getCommand);
  const userPosts = user.Item!?.posts.filter((post: any) => post.id !== req.body.id)

  const command = new UpdateCommand({
    TableName: "User",
    Key: {
      _id: req.user!._id
    },
    UpdateExpression: "set posts = :post",
    ExpressionAttributeValues: {
      ":post": userPosts,
    },
    ReturnValues: "NONE",
  });
  const response = await ddbDocClient.send(command);
  res.status(200).json({
    message: 'Başarılı!',
    response
  })
})

router.post('/add-todo', async (req: Request, res: Response) => {

  const getCommand = new GetCommand({
    TableName: "User",
    Key: {
      _id: req.user!._id
    }
  });
  const user = await ddbDocClient.send(getCommand);
  const todos = user.Item!?.todos?.length > 0 ? user.Item!.todos : []
  const newTodo = {
    subject: req.body.subject,
    detail: req.body.detail,
    date: req.body.date,
    id: uuidv4(),
    createdAt: Date.now()
  }
  const command = new UpdateCommand({
    TableName: "User",
    Key: {
      _id: req.user!._id
    },
    UpdateExpression: "set todos = :todos",
    ExpressionAttributeValues: {
      ":todos": [...todos, newTodo],
    },
    ReturnValues: "ALL_NEW",
  });
  const response = await ddbDocClient.send(command);
  res.status(200).json({
    message: 'Başarılı!',
    response
  })
})

router.get('/get-todos', async (req: Request, res: Response) => {
  const command = new GetCommand({
    TableName: "User",
    Key: {
      _id: req.user!._id
    },
    ProjectionExpression: 'todos'
  });

  const response = await ddbDocClient.send(command);
  res.status(200).json({
    message: 'Başarılı!',
    todos: response.Item!.todos || []
  })
})

export const signUp = async (req: Request, res: Response) => {
  const { email, password, name, surname } = req.body

  const checkIsEmailExist = new GetCommand({
    TableName: "Users",
    Key: {
      email
    }
  });
  const checkIsEmailExistResponse = await ddbDocClient.send(checkIsEmailExist);

  if (checkIsEmailExistResponse.Item) return res.status(400).send({ message: 'Bu email zaten kullanımda!' })

  let hashedPass = await bcrypt.hash(password, 11)
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
}

export const login = async (req: Request, res: Response) => {

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

  if (!isPasswordTrue) return res.status(400).json({
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

  res.cookie('jwt', refreshToken, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000, secure: true, sameSite: 'none' })

  res.status(200).json({
    user: {
      email: user.Item.email,
      name: user.Item.name,
      surname: user.Item.surname,
      _id: user.Item._id,
    },
    accessToken,
  })

}

export default router