const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const amqplib = require("amqplib");

const {
  APP_SECRET,
  EXCHANGE_NAME,
  SHOPPING_SERVICE,
  MSG_QUEUE_URL,
} = require("../config");

// Global connection and channel management
let connection = null;
let channel = null;

//Utility functions
module.exports.GenerateSalt = async () => {
  return await bcrypt.genSalt();
};

module.exports.GeneratePassword = async (password, salt) => {
  return await bcrypt.hash(password, salt);
};

module.exports.ValidatePassword = async (
  enteredPassword,
  savedPassword,
  salt
) => {
  return (await this.GeneratePassword(enteredPassword, salt)) === savedPassword;
};

module.exports.GenerateSignature = async (payload) => {
  try {
    return await jwt.sign(payload, APP_SECRET, { expiresIn: "30d" });
  } catch (error) {
    console.log(error);
    return error;
  }
};

module.exports.ValidateSignature = async (req) => {
  try {
    const signature = req.get("Authorization");
    console.log(signature);
    const payload = await jwt.verify(signature.split(" ")[1], APP_SECRET);
    req.user = payload;
    return true;
  } catch (error) {
    console.log(error);
    return false;
  }
};

module.exports.FormateData = (data) => {
  if (data) {
    return { data };
  } else {
    throw new Error("Data Not found!");
  }
};

//Message Broker with improved error handling and retry logic
module.exports.CreateChannel = async () => {
  const maxRetries = 5;
  const retryDelay = 5000;

  for (let i = 0; i < maxRetries; i++) {
    try {
      if (!connection) {
        console.log(`Attempting to connect to RabbitMQ (attempt ${i + 1}/${maxRetries})`);
        connection = await amqplib.connect(MSG_QUEUE_URL);
        
        // Handle connection events
        connection.on('error', (err) => {
          console.error('RabbitMQ connection error:', err);
          connection = null;
          channel = null;
        });

        connection.on('close', () => {
          console.log('RabbitMQ connection closed');
          connection = null;
          channel = null;
        });
      }

      if (!channel) {
        channel = await connection.createChannel();
        
        // Handle channel events
        channel.on('error', (err) => {
          console.error('RabbitMQ channel error:', err);
          channel = null;
        });

        channel.on('close', () => {
          console.log('RabbitMQ channel closed');
          channel = null;
        });

        // Assert exchange (NOT queue)
        await channel.assertExchange(EXCHANGE_NAME, "direct", { durable: true });
        console.log(`Exchange ${EXCHANGE_NAME} asserted successfully`);
      }

      return channel;
    } catch (err) {
      console.error(`Connection attempt ${i + 1} failed:`, err.message);
      
      // Reset connection and channel on error
      connection = null;
      channel = null;
      
      if (i < maxRetries - 1) {
        console.log(`Retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
  
  throw new Error('Failed to connect to RabbitMQ after multiple attempts');
};

module.exports.PublishMessage = async (channel, service, msg) => {
  try {
    if (!channel) {
      throw new Error('Channel is not available');
    }
    
    const published = channel.publish(
      EXCHANGE_NAME, 
      service, 
      Buffer.from(msg),
      { persistent: true } // Make message persistent
    );
    
    if (published) {
      console.log("Message sent successfully:", msg);
    } else {
      console.log("Message queued, waiting for drain event");
      
      // Wait for drain event if publish buffer is full
      await new Promise((resolve) => {
        channel.once('drain', resolve);
      });
    }
  } catch (error) {
    console.error('Error publishing message:', error);
    throw error;
  }
};

module.exports.SubscribeMessage = async (channel, service) => {
  try {
    if (!channel) {
      throw new Error('Channel is not available');
    }

    // Assert exchange
    await channel.assertExchange(EXCHANGE_NAME, "direct", { durable: true });
    
    // Create exclusive queue for this service
    const q = await channel.assertQueue("", { 
      exclusive: true,
      autoDelete: true 
    });
    
    console.log(`Waiting for messages in queue: ${q.queue}`);

    // Bind queue to exchange with routing key
    await channel.bindQueue(q.queue, EXCHANGE_NAME, SHOPPING_SERVICE);
    console.log(`Queue bound to exchange ${EXCHANGE_NAME} with routing key ${SHOPPING_SERVICE}`);

    // Set prefetch to control message processing
    await channel.prefetch(1);

    // Consume messages
    channel.consume(
      q.queue,
      async (msg) => {
        if (msg && msg.content) {
          try {
            const messageContent = msg.content.toString();
            console.log("Received message:", messageContent);
            
            // Process the message
            await service.SubscribeEvents(messageContent);
            
            // Acknowledge the message
            channel.ack(msg);
            console.log("Message processed and acknowledged");
          } catch (error) {
            console.error("Error processing message:", error);
            // Reject message and requeue
            channel.nack(msg, false, true);
          }
        }
      },
      {
        noAck: false, // Change to false for manual acknowledgment
      }
    );
  } catch (error) {
    console.error('Error setting up message subscription:', error);
    throw error;
  }
};

// Graceful shutdown
module.exports.CloseConnection = async () => {
  try {
    if (channel) {
      await channel.close();
      console.log('RabbitMQ channel closed');
    }
    if (connection) {
      await connection.close();
      console.log('RabbitMQ connection closed');
    }
  } catch (error) {
    console.error('Error closing RabbitMQ connection:', error);
  }
};

// Health check
module.exports.IsConnected = () => {
  return connection && !connection.connection.stream.destroyed;
};