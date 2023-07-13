import express, { Request, Response } from 'express';
import { GetCommand, UpdateCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import bcrypt from "bcrypt"
import fflate from 'fflate'
import { imageUpload } from "../../utils/functions";
import { ddbDocClient } from "../../aws/config";
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'

const router = express.Router();

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
  const { photos, subject, detail, date } = req.body
  const getCommand = new GetCommand({
    TableName: "User",
    Key: {
      _id: req.user!._id
    }
  });
  const user = await ddbDocClient.send(getCommand);
  const todos = user.Item!?.todos?.length > 0 ? user.Item!.todos : []

  let imagesUrls = []
  if (photos.length) {
    imagesUrls = await Promise.all(photos.map(async (photo: any) => {
      let data = Buffer.from(photo.base64, 'base64')
      let inflatedData = fflate.decompressSync(data)
      let url = await imageUpload(photo.name, inflatedData, photo.type)
      return url
    }))
  }
  const newTodo = {
    subject,
    detail,
    date,
    photos: imagesUrls,
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
  }, process.env.ACCESS_SECRET_KEY!, { expiresIn: '59m' })

  const refreshToken = jwt.sign({
    email: user.Item.email,
    name: user.Item.name,
    surname: user.Item.surname,
    _id: user.Item._id,
  }, process.env.REFRESH_SECRET_KEY!, { expiresIn: '1d' })

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