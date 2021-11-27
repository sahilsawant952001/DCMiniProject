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
mongoose.connect("mongodb://localhost:27017/foodDB3",{useNewUrlParser:true ,useUnifiedTopology:true});

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
let serverLoadCount = [0,0,0,0,0];
const serverPortMapping = [0,3000,4000,5000,6000];

//var to handle election algo
var p =1;

//arr to handle connections
var connectionCount = [0,0,0,0,0];

//server count
const totalServers = 3;

//server ids
const selfServerId = 3;
var masterServerId = 3;

//vars for critical section 
var insideCriticalSection = 0;
var wantToEnterCriticalSection = 0;
var myTimeStamp = 0;
var replyCount = 0;

var queue = [];

//function to return port of minimum load server
function getListLoadServerPort()
{
  var minLoad = 100000;
  var minLoadServId = 0;

  serverLoadCount.forEach((c,index) => {
    if(c<minLoad){
      minLoad = c;
      minLoadServId = index;
    }
  });
  return serverPortMapping[minLoadServId];
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
const server2 = socketClient("http://localhost:4000");
const server1 = socketClient("http://localhost:3000");
const server4 = socketClient("http://localhost:6000");

//listen for new co-ordinator
server2.on("broadcast",(serverId)=>{
  console.log("server ",serverId," is coordinator");
  masterServerId = serverId;
  p = 1;
  count = 0;
})

server1.on("broadcast",(serverId)=>{
  console.log("server ",serverId," is coordinator");
  masterServerId = serverId;
  p = 1;
  count = 0;
})

server4.on("broadcast",(serverId)=>{
  console.log("server ",serverId," is coordinator");
  masterServerId = serverId;
  p = 1;
  count = 0;
})

//listen for newly initiated election
server2.on("init",(serverId)=>{
  console.log("server ",serverId," initiated election");
})

server1.on("init",(serverId)=>{
  console.log("server ",serverId," initiated election");
})

server4.on("init",(serverId)=>{
  console.log("server ",serverId," initiated election");
})

//listen for okay message from servers
server2.on("okay message",(serverId)=>{
    console.log("okay message from ",serverId)
    count = count + 1;
})

server1.on("okay message",(serverId)=>{
    console.log("okay message from ",serverId)
    count = count + 1;
})

server4.on("okay message",(serverId)=>{
    console.log("okay message from ",serverId)
    count = count + 1;
})

//listen for master id
server2.on("master-id",(serverId)=>{
  masterServerId = serverId;
})

server1.on("master-id",(serverId)=>{
  masterServerId = serverId;
})

server4.on("master-id",(serverId)=>{
  masterServerId = serverId;
})

//listen database access request
server2.on("request",(req)=>{
  eventEmitter.emit("send reply",req);
})

server1.on("request",(req)=>{
  eventEmitter.emit("send reply",req);
})

server4.on("request",(req)=>{
  eventEmitter.emit("send reply",req);
})

//listen database access reply
server2.on("reply",(serverId)=>{
  replyCount = replyCount + 1;
  if(replyCount===totalServers-1)
  {
    eventEmitter.emit("acquire critical section");
  }
})

server1.on("reply",(serverId)=>{
  replyCount = replyCount + 1;
  if(replyCount===totalServers-1)
  {
    eventEmitter.emit("acquire critical section");
  }
})

server4.on("reply",(serverId)=>{
  replyCount = replyCount + 1;
  if(replyCount===totalServers-1)
  {
    eventEmitter.emit("acquire critical section");
  }
})

server2.on("update-database",(data)=>{
  eventEmitter.emit("update-database-info",data);
})

server1.on("update-database",(data)=>{
  eventEmitter.emit("update-database-info",data);
})

server4.on("update-database",(data)=>{
  eventEmitter.emit("update-database-info",data);
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
      if(serverId===4){
        server4.emit("join",selfServerId);
      }else if(serverId===2){
        server2.emit("join",selfServerId);
      }else if(serverId===3){
        server1.emit("join",selfServerId);
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
eventEmitter.on("update-database-info",(data) => {
  Meals.updateOne({_id:1},{quantity:data.cheeseBurgerQuantity},(er1,rs1)=>{});
  Meals.updateOne({_id:2},{quantity:data.vegBurgerQuantity},(er1,rs1)=>{});
  Meals.updateOne({_id:3},{quantity:data.chickenBurgerQuantity},(er1,rs1)=>{});
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
      if(count==0)
      {
           io.sockets.emit('broadcast',selfServerId);
      }
    },5000);
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

//routes
app.get("/my-orders/:orderId",checkAuth,(req,res) => {
  Order.find({_id:req.params.orderId},(err,result) => {
    if(err){
      res.send("error",{errorMessage:("failed fetch details of order"+req.params.orderId)});
    }else{
      res.render("order",{order:result[0]});
    }
  })
})

app.get("/my-orders",checkAuth,(req,res) => {
  const userId = req.body.userData.userId;

  Order.find({userId:userId},(err,result) => {
    if(err){
      res.send("error",{errorMessage:"failed fetch your orders"});
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
  setTimeout(() => {
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
        res.render("error",{errorMessage:"Failed To Place Order Try Again"});
      }else{
        if(result1[0].quantity>= parseInt(cheeseBurgerQuantity) && result1[1].quantity>= parseInt(vegBurgerQuantity) && result1[2].quantity >= parseInt(chickenBurgerQuantity))
        {
          const newOrder = new Order({
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
          })

          newOrder.save((err2,result2) => {
            if(err2){
              res.render("error",{errorMessage:"Failed To Place Order Try Again"});
            }else{
              const data = {
                cheeseBurgerQuantity:result1[0].quantity-parseInt(cheeseBurgerQuantity),
                vegBurgerQuantity:result1[0].quantity-parseInt(vegBurgerQuantity),
                chickenBurgerQuantity:result1[0].quantity-parseInt(chickenBurgerQuantity)
              }
              for(var i=1;i<=totalServers;i++)
              {
                io.to(i).emit("update-database",data);
              }
              res.render("orderSuccess");
            }
          })
        }
        else
        {
          res.render("error",{errorMessage:"Enough Quantity Not Available"});
        }
      }
    })
    insideCriticalSection = 0;
    replyCount = 0;
    for(var i=0;i<queue.length;i++)
    {
      io.to(queue[i]).emit("reply",selfServerId);
      queue = queue.slice(1,queue.length);
    }
    console.log("server 1 outside critical section");
  }, 15000);
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
                        expiresIn: 600000000
                    }
                )
                let options = {
                  maxAge: 600000000, // would expire after 1 minuite
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

            const newUser = new Users({
              email:email,
              password:hash,
              name:name,
              surname:surname
            })
            
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

http.listen(5000, function() {
  console.log('Food App Server 1 Listening On Port ',5000);
  setTimeout(()=>{
    server2.emit("join",selfServerId);
    server1.emit("join",selfServerId);
    server4.emit("join",selfServerId);
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
          server2.emit("leave",selfServerId);
          server1.emit("leave",selfServerId);
          server4.emit("leave",selfServerId);
          resolve();
      });
  }
});