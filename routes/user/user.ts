import { CreateTableCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import express, { Request, Response } from 'express';
import { DynamoDBDocument, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
const router = express.Router();
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
    ProjectionExpression:'posts'
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

export default router