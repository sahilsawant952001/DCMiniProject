//imports
require("dotenv").config();
const express = require("express");
const socketClient = require("socket.io-client");
const addExitCallback = require('catch-exit').addExitCallback;
const mongoose = require('mongoose');
const axios = require("axios");
const ejs = require("ejs");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const checkAuth = require("./checkAuth");
var cookieParser = require('cookie-parser');

//db connection
mongoose.connect("mongodb://localhost:27017/foodDB4",{useNewUrlParser:true ,useUnifiedTopology:true});

//db schemas
const mealsSchema = {
  _id:Number,
  name:String,
  quantity:Number,
  price:Number,
  imageUrl:String
}

const userSchema = {
  email:String,
  password:String,
  name:String,
  surname:String
}

const ordersSchema = {
  name:String,
  surname:String,
  email:String,
  userId:String,
  cheeseBurgerQuantity:Number,
  vegBurgerQuantity:Number,
  chickenBurgerQuantity:Number,
  address:String,
  contact:String,
  orderStatus:String
}

//db models
const Meals = mongoose.model("meals",mealsSchema);
const Users = mongoose.model("users",userSchema);
const Order = mongoose.model("orders",ordersSchema);

//server info
var ptr = 1;
const serverPortMapping = [0,3000,4000,5000,7000];

//var to handle election algo
var p =1;

//arr to handle connections
var connectionCount = [0,0,0,0,0];

//server count
const totalServers = 4;

//server ids
const selfServerId = 4;
var masterServerId = 4;

//vars for critical section 
var insideCriticalSection = 0;
var wantToEnterCriticalSection = 0;
var myTimeStamp = 0;
var replyCount = 0;

var queue = [];

//function to return port of minimum load server
function getServerPort()
{
  ptr = (ptr+1)%(totalServers+1);
  if(ptr===0 || ptr===selfServerId){
    ptr = (ptr+1)%(totalServers+1);
  }
  if(ptr===0 || ptr===selfServerId){
    ptr = (ptr+1)%(totalServers+1);
  }
  return serverPortMapping[ptr];
}


function maintain_me_and_dc(req,res,next){
  wantToEnterCriticalSection = 1;
  for(var i=1;i<=totalServers;i++)
  {
    if(i!=selfServerId)
    {
      var date = new Date();
      var data = {
        timeStamp:date,
        serverId:selfServerId
      }
      io.to(i).emit("request",data);
    }
  }

  eventEmitter.on("acquire critical section",() => {
    wantToEnterCriticalSection = 0;
    insideCriticalSection = 1;
    next();
  })
}


//event emmiter
const Emitter = require('events');
const eventEmitter = new Emitter();

//app setting
const app = express();
app.use(express.urlencoded({extended:true}))
app.use(express.json())
app.set('eventEmitter',eventEmitter);
app.set('view engine', 'ejs');
app.use(cookieParser())

//count
var count = 0;

//server and socket setup
const http = require('http').createServer(app)
const io = require('socket.io')(http, {
  cors: {
    origin: '*',
  }
})

//connections with other servers
const server1 = socketClient("http://localhost:3000");
const server2 = socketClient("http://localhost:4000");
const server3 = socketClient("http://localhost:5000");

//listen for new co-ordinator
server1.on("broadcast",(serverId)=>{
  console.log("server ",serverId," is coordinator");
  masterServerId = serverId;
  p = 1;
  count = 0;
})

server2.on("broadcast",(serverId)=>{
  console.log("server ",serverId," is coordinator");
  masterServerId = serverId;
  p = 1;
  count = 0;
})

server3.on("broadcast",(serverId)=>{
  console.log("server ",serverId," is coordinator");
  masterServerId = serverId;
  p = 1;
  count = 0;
})

//listen for election message
server1.on("election message",serverId => {
  io.to(serverId).emit("okay message",selfServerId);
})

server2.on("election message",serverId => {
  io.to(serverId).emit("okay message",selfServerId);
})

server3.on("election message",serverId => {
  io.to(serverId).emit("okay message",selfServerId);
})

//listen for newly initiated election
server1.on("init",(serverId)=>{
  console.log("server ",serverId," initiated election");
})

server2.on("init",(serverId)=>{
  console.log("server ",serverId," initiated election");
})

server3.on("init",(serverId)=>{
  console.log("server ",serverId," initiated election");
})

//listen for okay message from servers
server1.on("okay message",(serverId)=>{
    console.log("okay message from ",serverId)
    count = count + 1;
})

server2.on("okay message",(serverId)=>{
    console.log("okay message from ",serverId)
    count = count + 1;
})

server3.on("okay message",(serverId)=>{
    console.log("okay message from ",serverId)
    count = count + 1;
})

//listen for master id
server1.on("master-id",(serverId)=>{
  masterServerId = serverId;
})

server2.on("master-id",(serverId)=>{
  masterServerId = serverId;
})

server3.on("master-id",(serverId)=>{
  masterServerId = serverId;
})

//listen database access request
server1.on("request",(req)=>{
  eventEmitter.emit("send reply",req);
})

server2.on("request",(req)=>{
  eventEmitter.emit("send reply",req);
})

server3.on("request",(req)=>{
  eventEmitter.emit("send reply",req);
})

//listen database access reply
server1.on("reply",(serverId)=>{
  replyCount = replyCount + 1;
  if(replyCount===totalServers-1)
  {
    eventEmitter.emit("acquire critical section");
  }
})

server2.on("reply",(serverId)=>{
  replyCount = replyCount + 1;
  if(replyCount===totalServers-1)
  {
    eventEmitter.emit("acquire critical section");
  }
})

server3.on("reply",(serverId)=>{
  replyCount = replyCount + 1;
  if(replyCount===totalServers-1)
  {
    eventEmitter.emit("acquire critical section");
  }
})

//listen for database update - meals
server1.on("update-database-meals",(data)=>{
  eventEmitter.emit("update-database-meals-e",data);
})

server2.on("update-database-meals",(data)=>{
  eventEmitter.emit("update-database-meals-e",data);
})

server3.on("update-database-meals",(data)=>{
  eventEmitter.emit("update-database-meals-e",data);
})


//listen for database update - orders
server1.on("update-database-orders",(data)=>{
  eventEmitter.emit("update-database-orders-e",data);
})

server2.on("update-database-orders",(data)=>{
  eventEmitter.emit("update-database-orders-e",data);
})

server3.on("update-database-orders",(data)=>{
  eventEmitter.emit("update-database-orders-e",data);
})

//listen for database update - orders
server1.on("update-database-users",(data)=>{
  eventEmitter.emit("update-database-users-e",data);
})

server2.on("update-database-users",(data)=>{
  eventEmitter.emit("update-database-users-e",data);
})

server3.on("update-database-users",(data)=>{
  eventEmitter.emit("update-database-users-e",data);
})

//listen for incoming connections to socket
io.on('connection', socket => {
  //join event
  socket.on('join', ( serverId ) => {
    socket.join(serverId);
    connectionCount[serverId] = connectionCount[serverId] + 1;
    console.log('new socket connection with server ',serverId);
    io.to(serverId).emit("master-id",masterServerId);
    if(connectionCount[serverId]>1)
    {
      if(serverId===3){
        server3.emit("join",selfServerId);
      }else if(serverId===1){
        server1.emit("join",selfServerId);
      }else if(serverId===2){
        server2.emit("join",selfServerId);
      }
    }
  })

  //leave event
  socket.on('leave',(serverId) =>{
    console.log("server ",serverId,"is not running");
    if(serverId===masterServerId){
      io.sockets.emit('init',selfServerId);
      eventEmitter.emit("send election message");
    }
  })
});

//emit event to update database 
eventEmitter.on("update-database-meals-e",(data) => {
  Meals.updateOne({_id:1},{quantity:data.cheeseBurgerQuantity},(er1,rs1)=>{});
  Meals.updateOne({_id:2},{quantity:data.vegBurgerQuantity},(er1,rs1)=>{});
  Meals.updateOne({_id:3},{quantity:data.chickenBurgerQuantity},(er1,rs1)=>{});
})

eventEmitter.on("update-database-orders-e",(data) => {
  const newOrder = new Order(data);
  newOrder.save((err,result) => {})
})

eventEmitter.on("update-database-users-e",(data) => {
  const newUser = new Users(data);
  newUser.save((err,result) => {})
})


//emit event to send election election message to other servers
eventEmitter.on("send election message",()=>{
  if(p>0)
  {
    for(var i=selfServerId+1;i<=totalServers;i++)
    {
      if(i!=selfServerId)
      {
        io.to(i).emit("election message",selfServerId);
      }
    }
    setTimeout(() => {
      if(count===0)
      {
           io.sockets.emit('broadcast',selfServerId);
           masterServerId = selfServerId;
      }
    },10000);
    p=p-1;
  }
})

//event emmiter to send reply
eventEmitter.on("send reply",(req) => {
  if(wantToEnterCriticalSection===0 && insideCriticalSection===0)
  {
    io.to(req.serverId).emit("reply",selfServerId);
  }
  else
  {
    if(myTimeStamp > req.timeStamp)
    {
      io.to(req.serverId).emit("reply",selfServerId);
    }
    else
    {
        queue.push(req.serverId);
    }
  }
})


app.get("/get-master-port",(req,res) => {
  res.send({
    masterPort:serverPortMapping[masterServerId]
  });
})

//routes
app.get("/my-orders/:orderId",checkAuth,(req,res) => {
  Order.find({_id:req.params.orderId},(err,result) => {
    if(err){
      res.render("error",{errorMessage:("failed fetch details of order"+req.params.orderId)});
    }else{
      res.render("order",{order:result[0]});
    }
  })
})

app.get("/my-orders",checkAuth,(req,res) => {
  const userId = req.body.userData.userId;

  Order.find({userId:userId},(err,result) => {
    if(err){
      res.render("error",{errorMessage:"failed fetch your orders"});
    }else{
      res.render("myOrders",{myOrders:result});
    }
  })
})

app.get("/food-items",(req,res)=>{
  Meals.find({},(err,result)=>{
    if(err){
      res.render("error",{errorMessage:"Failed To Failed To Fetch Details Of Food Items"});
    }else{
      res.render("foods",{foodItems:result});
    }
  })
})

app.post("/order-food",checkAuth,maintain_me_and_dc,(req,res)=>{
  console.log("server 1 inside critical section");
  const name = req.body.userData.name;
  const surname = req.body.userData.surname;
  const email = req.body.userData.email;
  const cheeseBurgerQuantity = req.body.cheese_burger_quantity;
  const vegBurgerQuantity = req.body.veg_burger_quantity;
  const chickenBurgerQuantity = req.body.chicken_burger_quantity;
  const address = req.body.address;
  const contact = req.body.contact;

  Meals.find({},(err1,result1) => {
    if(err1){
      insideCriticalSection = 0;
      replyCount = 0;
      console.log("server 1 outside critical section");
      res.render("error",{errorMessage:"Failed To Place Order Try Again"});
    }else{
      if(result1[0].quantity>= parseInt(cheeseBurgerQuantity) && result1[1].quantity>= parseInt(vegBurgerQuantity) && result1[2].quantity >= parseInt(chickenBurgerQuantity))
      {
        const _order = {
          name:name,
          surname:surname,
          email:email,
          cheeseBurgerQuantity:cheeseBurgerQuantity,
          vegBurgerQuantity:vegBurgerQuantity,
          chickenBurgerQuantity:chickenBurgerQuantity,
          address:address,
          contact:contact,
          orderStatus:"-",
          userId:req.body.userData.userId
        };

        const newOrder = new Order(_order);

        newOrder.save((err2,result2) => {
          if(err2){
            insideCriticalSection = 0;
            replyCount = 0;
            console.log("server 1 outside critical section");
            res.render("error",{errorMessage:"Failed To Place Order Try Again"});
          }else{
            const data = {
              cheeseBurgerQuantity:result1[0].quantity-parseInt(cheeseBurgerQuantity),
              vegBurgerQuantity:result1[0].quantity-parseInt(vegBurgerQuantity),
              chickenBurgerQuantity:result1[0].quantity-parseInt(chickenBurgerQuantity)
            }
            eventEmitter.emit("update-database-meals-e",data);
            for(var i=1;i<=totalServers;i++)
            {
              if(i!==selfServerId){
                io.to(i).emit("update-database-meals",data);
                io.to(i).emit("update-database-orders",_order);
              }
            }
            insideCriticalSection = 0;
            replyCount = 0;
            for(var i=0;i<queue.length;i++)
            {
              io.to(queue[i]).emit("reply",selfServerId);
              queue = queue.slice(1,queue.length);
            }
            console.log("server 1 outside critical section");
            res.render("orderSuccess");
          }
        })
      }
      else
      {
        insideCriticalSection = 0;
        replyCount = 0;
        console.log("server 1 outside critical section");
        res.render("error",{errorMessage:"Enough Quantity Not Available"});
      }
    }
  })
})

app.get("/",(req,res) => {
  if(selfServerId===masterServerId){
    res.redirect(`http://localhost:${getServerPort()}?f=m`)
  }
  else if(req.query.f==="m"){
    res.render("home");
  }
  else
  {
    res.redirect(`http://localhost:${serverPortMapping[masterServerId]}?f=m`)
  }
})

app.get("/login",(req,res) => {
  res.render("login");
})

app.get("/register",(req,res) => {
  res.render("register");
})

app.post("/login",async function(req,res){
  
  const email = req.body.email;
  const password = req.body.password;

  Users.find({email:email},(err1,result1)=>{
    if(err1){
      res.redirect("/login");
    }else{
      if(result1.length!==0)
      {
          bcrypt.compare(password, result1[0].password, function(err, result2) 
          {  
            if(result2===true)
            {
                const token = jwt.sign(
                    {
                      userId:result1[0]._id,
                      email:email,
                      name:result1[0].name,
                      surname:result1[0].surname
                    },
                    process.env.JWT_KEY,
                    {
                        expiresIn: 3600000 
                    }
                )
                let options = {
                  maxAge: 3600000 , // would expire after 1 minuite
                  httpOnly: true, // The cookie only accessible by the web server
                }
          
                res.cookie('x-access-token',token, options) 
                res.redirect("/food-items");
            }else
            {
              res.redirect("/login");
            }
        });
      }
      else
      {
        res.redirect("/login");
      }
    }
  })
})

app.post("/register",async function(req,res){
  const email = req.body.email;
  const password = req.body.password;
  const name = req.body.name;
  const surname = req.body.surname;

  Users.find({email:email},(err1,result1)=>{
    if(err1){
      res.redirect("/register");
    }else{
      if(result1.length>0){
        res.redirect("/register");
      }else{
          bcrypt.hash(password,2,(err,hash) => {

            const _user = {
              email:email,
              password:hash,
              name:name,
              surname:surname
            };

            const newUser = new Users(_user);
            
            newUser.save((err2,result2) => {
              if(err2){
                res.redirect("/register");
              }else{
                if(result2!==null && result2!==undefined){
                  const token = jwt.sign(
                    {
                        userId:result2._id,
                        email:email,
                        name:name,
                        surname:surname
                    },
                    process.env.JWT_KEY,
                    {
                        expiresIn:600000000
                    }
                  )
                  let options = {
                    maxAge: 600000000, // would expire after 1 minuite
                    httpOnly: true, // The cookie only accessible by the web server
                  }
                  for(var i=1;i<=totalServers;i++)
                  {
                    if(i!=selfServerId)
                    {
                      io.to(i).emit("update-database-users",_user);
                    }
                  }  
                  res.cookie('x-access-token',token, options) 
                  res.redirect("/food-items");
                }else{
                  res.redirect("/register");
                }
              }
            })
        })  
      }
    }
  })
})

app.get('/logout', (req, res) => {
  res.redirect("/");
});

http.listen(7000, function() {
  console.log('Food App Server 1 Listening On Port ',7000);
  setTimeout(()=>{
    server1.emit("join",selfServerId);
    server2.emit("join",selfServerId);
    server3.emit("join",selfServerId);
    setTimeout(() => {
      if(masterServerId<selfServerId){
        io.sockets.emit('init',selfServerId);
        eventEmitter.emit("send election message");
      }
    }, 5000);
  },5000);
});

//listen for server stop event
addExitCallback((signal) => {
  if (signal !== 'exit') {
      new Promise((resolve) => {
          server1.emit("leave",selfServerId);
          server2.emit("leave",selfServerId);
          server3.emit("leave",selfServerId);
          resolve();
      });
  }
});