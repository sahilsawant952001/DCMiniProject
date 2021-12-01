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
const checkAuthAdmin = require("./checkAuthAdmin");

//db connection
mongoose.connect("mongodb://localhost:27017/foodDB2",{useNewUrlParser:true ,useUnifiedTopology:true});

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
  orderStatus:String,
  date:Date
}


const adminSchema = {
  email:String,
  password:String,
  name:String,
  surname:String
}


//db models
const Meals = mongoose.model("meals",mealsSchema);
const Users = mongoose.model("users",userSchema);
const Order = mongoose.model("orders",ordersSchema);
const Admin = mongoose.model("admins",adminSchema);

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
const selfServerId = 2;
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
app.use(express.static("public"));

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
const server3 = socketClient("http://localhost:5000");
const server4 = socketClient("http://localhost:7000");

//listen for new co-ordinator
server1.on("broadcast",(serverId)=>{
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

server4.on("broadcast",(serverId)=>{
  console.log("server ",serverId," is coordinator");
  masterServerId = serverId;
  p = 1;
  count = 0;
})

//listen for election message
server1.on("election message",serverId => {
  io.to(serverId).emit("okay message",selfServerId);
})

//listen for newly initiated election
server1.on("init",(serverId)=>{
  console.log("server ",serverId," initiated election");
})

server3.on("init",(serverId)=>{
  console.log("server ",serverId," initiated election");
})

server4.on("init",(serverId)=>{
  console.log("server ",serverId," initiated election");
})

//listen for okay message from servers
server1.on("okay message",(serverId)=>{
    console.log("okay message from ",serverId)
    count = count + 1;
})

server3.on("okay message",(serverId)=>{
    console.log("okay message from ",serverId)
    count = count + 1;
})

server4.on("okay message",(serverId)=>{
    console.log("okay message from ",serverId)
    count = count + 1;
})

//listen for master id
server1.on("master-id",(serverId)=>{
  masterServerId = serverId;
})

server3.on("master-id",(serverId)=>{
  masterServerId = serverId;
})

server4.on("master-id",(serverId)=>{
  masterServerId = serverId;
})

//listen database access request
server1.on("request",(req)=>{
  eventEmitter.emit("send reply",req);
})

server3.on("request",(req)=>{
  eventEmitter.emit("send reply",req);
})

server4.on("request",(req)=>{
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

server3.on("reply",(serverId)=>{
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

//listen for database update - meals
server1.on("update-database-meals",(data)=>{
  eventEmitter.emit("update-database-meals-e",data);
})

server3.on("update-database-meals",(data)=>{
  eventEmitter.emit("update-database-meals-e",data);
})

server4.on("update-database-meals",(data)=>{
  eventEmitter.emit("update-database-meals-e",data);
})


//listen for database update - orders
server1.on("update-database-orders",(data)=>{
  eventEmitter.emit("update-database-orders-e",data);
})

server3.on("update-database-orders",(data)=>{
  eventEmitter.emit("update-database-orders-e",data);
})

server4.on("update-database-orders",(data)=>{
  eventEmitter.emit("update-database-orders-e",data);
})

//listen for database update - orders
server1.on("update-database-users",(data)=>{
  eventEmitter.emit("update-database-users-e",data);
})

server3.on("update-database-users",(data)=>{
  eventEmitter.emit("update-database-users-e",data);
})

server4.on("update-database-users",(data)=>{
  eventEmitter.emit("update-database-users-e",data);
})

server1.on("cancel-database-order",(data)=>{
  eventEmitter.emit("cancel-database-order-e",data);
})

server3.on("cancel-database-order",(data)=>{
  eventEmitter.emit("cancel-database-order-e",data);
})

server4.on("cancel-database-order",(data)=>{
  eventEmitter.emit("cancel-database-order-e",data);
})

server1.on("admin-order-status-update",(data)=>{
  eventEmitter.emit("admin-order-status-update-e",data);
})

server3.on("admin-order-status-update",(data)=>{
  eventEmitter.emit("admin-order-status-update-e",data);
})

server4.on("admin-order-status-update",(data)=>{
  eventEmitter.emit("admin-order-status-update-e",data);
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
      }else if(serverId===1){
        server1.emit("join",selfServerId);
      }else if(serverId===3){
        server3.emit("join",selfServerId);
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

eventEmitter.on("cancel-database-order-e",(orderId) => {
  Order.updateOne({_id:orderId},{orderStatus:"cancelled"},(err,result) => {})
})

eventEmitter.on("admin-order-status-update-e",(data) => {
  Order.updateOne({_id:data.orderId},{orderStatus:data.orderStatus},(err,result) => {});
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

app.get("/admin/orders/cancelled-orders",(req,res) => {
  Order.find({orderStatus:"cancelled"},(err,result) => {
    if(err){
      res.redirect("error");
    }else{
      res.render("adminCancelledOrders",{title:"Cancelled Orders",cancelledOrders:result});
    }
  })
})

app.get("/admin/orders/completed-orders",(req,res) => {
  Order.find({orderStatus:"completed"},(err,result) => {
    if(err){
      res.redirect("error");
    }else{
      res.render("adminCompletedOrders",{title:"Completed Orders",completedOrders:result});
    }
  })
})

app.get("/admin/orders",(req,res) => {
  Order.find({$and : [{orderStatus: {$ne:"completed"}},{orderStatus:{$ne : "cancelled"}}]},(err,result) => {
    if(err){
      res.redirect("error");
    }else{
      res.render("adminOrders",{pendingOrders:result});
    }
  })
})

app.get("/admin/orders/:orderId",(req,res) => {
  Order.find({_id:req.params.orderId},(err,result) => {
    if(err){
      res.render("error");
    }else{
      res.render("adminOrderUpdate",{order:result[0]});
    }
  })
})

app.post("/admin/orders/update/:orderId",(req,res) => {
  Order.updateOne({_id:req.params.orderId},{orderStatus:req.body.orderStatus},(err,result) => {
    if(err){
      res.render("error")
    }else{
      const data = {
        orderId:req.params.orderId,
        orderStatus:req.body.orderStatus
      }
      for(var i=1;i<=totalServers;i++)
      {
        if(i!==selfServerId)
        {
          io.to(i).emit("admin-order-status-update",data)
        }
      }
      res.redirect("/admin/orders");
    }
  })
})


app.post("/cancel-order",checkAuth,(req,res) => {
  const orderId = req.body.orderId;
  Order.deleteOne({_id:orderId},(err,result) => {
    if(err){
      const path = "/my-orders/"+orderId;
      res.redirect(path)
    }else{
      for(var i = 1;i<=totalServers;i++)
      {
        if(i!=selfServerId)
        {
          io.to(i).emit("cancel-database-order",orderId);
        }
      }
      res.render("cancelSuccess",{orderId:orderId,name:req.body.userData.name,surname:req.body.userData.surname});
    }
  })
})

app.get("/place-order",checkAuth,(req,res) => {
  res.render("placeOrder",{name:req.body.userData.name,surname:req.body.userData.surname});
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
      res.render("order",{order:result[0],name:req.body.userData.name,surname:req.body.userData.surname});
    }
  })
})

app.get("/my-orders",checkAuth,(req,res) => {
  const userId = req.body.userData.userId;

  Order.find({userId:userId},(err,result) => {
    if(err){
      res.render("error",{errorMessage:"failed fetch your orders"});
    }else{
      res.render("myOrders",{myOrders:result,name:req.body.userData.name,surname:req.body.userData.surname});
    }
  })
})

app.get("/food-items",checkAuth,(req,res)=>{
  Meals.find({},(err,result)=>{
    if(err){
      res.render("error",{errorMessage:"Failed To Failed To Fetch Details Of Food Items"});
    }else{
      res.render("foods",{foodItems:result,name:req.body.userData.name,surname:req.body.userData.surname});
    }
  })
})

app.post("/order-food",checkAuth,maintain_me_and_dc,(req,res)=>{
  console.log("server 1 inside critical section");
  const name = req.body.userData.name;
  const surname = req.body.userData.surname;
  const email = req.body.userData.email;
  var cheeseBurgerQuantity = req.body.cheese_burger_quantity;
  var vegBurgerQuantity = req.body.veg_burger_quantity;
  var chickenBurgerQuantity = req.body.chicken_burger_quantity;
  const address = req.body.address;
  const contact = req.body.contact;

  if(cheeseBurgerQuantity===undefined || cheeseBurgerQuantity==="" || cheeseBurgerQuantity===null)
  {
    cheeseBurgerQuantity = 0;
  }

  if(vegBurgerQuantity===undefined || vegBurgerQuantity ==="" || vegBurgerQuantity===null)
  {
    vegBurgerQuantity = 0;
  }

  if(chickenBurgerQuantity===undefined || chickenBurgerQuantity==="" || chickenBurgerQuantity===null)
  {
    chickenBurgerQuantity = 0;
  }

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
          userId:req.body.userData.userId,
          date: new Date()
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
            _order._id = result2._id;
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
            res.render("orderSuccess",{orderId:result2._id,name:req.body.userData.name,surname:req.body.userData.surname});
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

app.get("/admin/login",(req,res) => {
  res.render("adminLogin");
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
                      surname:result1[0].surname,
                      role:"user"
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

app.post("/admin/login",async function(req,res){
  
  const email = req.body.email;
  const password = req.body.password;

  Admin.find({email:email},(err1,result1)=>{
    if(err1){
      res.redirect("/admin/login");
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
                      surname:result1[0].surname,
                      time:new Date(),
                      role:"admin"
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
                res.redirect("/admin/orders");
            }else
            {
              res.redirect("/admin/login");
            }
        });
      }
      else
      {
        res.redirect("/admin/login");
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
                  _user._id = result2._id;
                  const token = jwt.sign(
                    {
                        userId:result2._id,
                        email:email,
                        name:name,
                        surname:surname,
                        role:"user"

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

app.get("/admin/update-food",checkAuthAdmin,(req,res) => {
  res.render("adminUpdateFoodQuantity");
})

app.post("/admin/update-food",checkAuthAdmin,maintain_me_and_dc,(req,res) => {
  var cheese_burger_quantity = req.body.cheese_burger_quantity;
  var veg_burger_quantity = req.body.veg_burger_quantity;
  var chicken_burger_quantity = req.body.chicken_burger_quantity;

  const data = {
    cheeseBurgerQuantity:cheese_burger_quantity,
    vegBurgerQuantity:veg_burger_quantity,
    chickenBurgerQuantity:chicken_burger_quantity
  }

  console.log("--> 1")
  Meals.findById({_id:1},(err1,result1)=>
  {
    if(err1)
    {
      console.log("error 1",err1);
    }
    else
    {
      if(cheese_burger_quantity!==undefined && cheese_burger_quantity!=="" && cheese_burger_quantity!==null)
      {
        result1.quantity = cheese_burger_quantity;
        result1.save();
      }
      else
      {
        data.cheeseBurgerQuantity = result1.quantity;
      }
      Meals.findById({_id:2},(err2,result2)=>
      {
        if(err2)
        {
          console.log("error 2",err2);
        }
        else
        {
          if(veg_burger_quantity!==undefined && veg_burger_quantity!=="" && veg_burger_quantity!==null)
          {
            result2.quantity = veg_burger_quantity;
            result2.save();
          }
          else
          {
            data.vegBurgerQuantity = result2.quantity;
          }
          Meals.findById({_id:3},(err3,result3)=>
          {
            if(err2)
            {
              console.log("error 3",err3);
            }
            else
            {
              if(chicken_burger_quantity!==undefined && chicken_burger_quantity!=="" && chicken_burger_quantity!==null)
              {
                result3.quantity = chicken_burger_quantity;
                result3.save();
              }
              else
              {
                data.chickenBurgerQuantity = result3.quantity;
              }
              for(var i=1;i<=totalServers;i++)
              {
                if(i!==selfServerId)
                {
                  io.to(i).emit("update-database-meals",data)
                }
              }
            }
          })
        }
      })
    }
  })
  replyCount = 0;
  insideCriticalSection = 0;
  res.redirect("/admin/orders");
})

app.get('/logout', (req, res) => {
  res.redirect("/");
});

http.listen(4000, function() {
  console.log('Food App Server 1 Listening On Port ',4000);
  setTimeout(()=>{
    server1.emit("join",selfServerId);
    server3.emit("join",selfServerId);
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
          server1.emit("leave",selfServerId);
          server3.emit("leave",selfServerId);
          server4.emit("leave",selfServerId);
          resolve();
      });
  }
});