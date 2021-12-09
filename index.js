const session = require("express-session");
const express = require('express')
var bodyParser = require('body-parser')
const app = express()
const path = require("path");
const port = 3000;

app.use(express.json())

app.set("views", path.join(__dirname, "views"));
app.set('view engine', 'ejs');

var jsonParser = bodyParser.json()

var urlencodedParser = bodyParser.urlencoded({ extended: false })

app.use(
    session({
        secret: "secret",
        resave: true,
        saveUninitialized: true
    })
);

const Pool = require('pg').Pool
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'finalweb',
  password: '1111',
  port: 5432,
})

app.get("/login", function(request, response) {
    response.sendFile(path.join(__dirname + "/login.html"));
});

app.get("/register", function(request, response) {
  response.sendFile(path.join(__dirname + "/register.html"));
});


app.post("/signup", urlencodedParser, (request, response) => {
  var username = request.body.username;
  var email = request.body.email;
  var password = request.body.password;
  var currentDate = new Date()
  pool.query(`INSERT INTO public.userdata VALUES (default,$1, $2, $3, $4)`,[username,password,email,currentDate]);
  request.session.loggedin = true;
  request.session.username = username;
  delay(1000).then(() => pool.query(`SELECT * FROM public.userdata WHERE username = $1`,[username] , (err, resultss)=>{
    pool.query(`INSERT INTO public.ttt VALUES ($1,$2,null,$3)`,[resultss.rows[0].user_id,0,username])
  }));
  
  response.redirect("/webboard");
  
});

function delay(time) {
  return new Promise(resolve => setTimeout(resolve, time));
}


app.post("/update_ttt_win/:id", urlencodedParser, (req,res) =>{
  var now = new Date()
  pool.query(`SELECT * FROM public.userdata WHERE username = $1`,[req.session.username] , (errr, userss)=>{
    pool.query(`SELECT * FROM public.ttt WHERE player_id = $1`,[userss.rows[0].user_id] , (errr, datas)=>{
      console.log("get_ttt_data");
      pool.query(`UPDATE public.ttt SET win = $1 WHERE player_id = $2`,[datas.rows[0].win + 1,userss.rows[0].user_id]);
      pool.query(`UPDATE public.ttt SET last_play = $1 WHERE player_id = $2`,[now,userss.rows[0].user_id]);
      console.log("TTT score updated");
    })
  });
});

app.get("/ox_game", function(request, response){
  pool.query(`SELECT * FROM public.ttt ORDER BY win ASC `, (err, scoreboard) => {
      response.render("ox.ejs", {
        user: request.session.username,
        scoreboard: scoreboard
      })
    });
});

app.get("/popcat", function(request, response){
  response.render("popcat.ejs", {
        user: request.session.username,

      })
});

app.get("/howto", function(request, response){
  response.render("game_howtoplay.ejs", {
        user: request.session.username,

      })
});

app.get("/game", function(request, response){
  response.render("game_list.ejs", {
        user: request.session.username,
      })
});


app.post("/groupadd", urlencodedParser, (req,res)=>{

  pool.query(`SELECT * FROM public.userdata WHERE username = $1`,[req.session.username] , (err, resultss)=>{
    var owner_id = resultss.rows[0].user_id
    var name = req.body.add_group_name;
    var join_code = (Math.random() + 1).toString(36).substring(7);
    pool.query(`INSERT INTO public.group_data VALUES (default,$1,default,$2,$3,$4)`,[owner_id,name,join_code,[owner_id]]);
    res.redirect("/webboard");
    console.log("Create Group with invite code (",join_code,")")
  })
})

app.post("/groupjoin", urlencodedParser, (req,res)=>{
  pool.query(`SELECT * FROM public.userdata WHERE username = $1`,[req.session.username] , (err, resultss)=>{
    var user_id = resultss.rows[0].user_id;
    var join_code = req.body.join_code;
    pool.query(`SELECT joined_users FROM public.group_data WHERE join_code = $1`,[join_code], (err, results) => {
      const joined_users = results.rows[0].joined_users
      joined_users.push(user_id)
      pool.query(`UPDATE public.group_data SET joined_users = $1 WHERE join_code = $2`,[joined_users,join_code]);
    })
    res.redirect("/webboard");
    console.log("User id ",user_id," joined group with invite code (",join_code,")")
  });
  
})

app.post("/groupremove/:id", urlencodedParser, (req,res)=>{
  var id = req.params.id;
  console.log("Delete Group ID:" + id);
  pool.query(`DELETE FROM public.group_data WHERE group_id = $1`,[id]);
  res.redirect("/webboard");
});

app.post("/group_note/groupremove/:id", urlencodedParser, (req,res)=>{
  var id = req.params.id;
  console.log("Delete Group ID:" + id);
  pool.query(`DELETE FROM public.group_data WHERE group_id = $1`,[id]);
  res.redirect("/group_select");
});

app.post("/noteadd", urlencodedParser, (request, response) => {
  var header = request.body.header;
  var body_text = request.body.body_text;
  var end_date = new Date(request.body.due_date)
  var currentDate = new Date()
  if(end_date == "Invalid Date"){
    end_date = null
  }

  pool.query(`SELECT * FROM public.userdata WHERE username = $1`,[request.session.username] , (err, results)=>{
    pool.query(`INSERT INTO public.notedata VALUES (default, $1, $2, $3, $4, $5)`,[header,body_text,currentDate,end_date,results.rows[0].user_id]);
  })
  response.redirect("/webboard");
  console.log("Create note")
});

app.post("/noteremove/:id", urlencodedParser, (req,res)=>{
  var id = req.params.id;
  console.log("Delete Note ID:" + id);
  pool.query(`DELETE FROM public.notedata WHERE note_id = $1`,[id]);
  res.redirect("/webboard");
});

app.post("/group_note/noteremove/:id/:group", urlencodedParser, (req,res)=>{
  var id = req.params.id;
  console.log("Delete Note ID:" + id);
  pool.query(`DELETE FROM public.notedata WHERE note_id = $1`,[id]);
  res.redirect("/group_note/" + req.params.group);
});

app.post("/group_note/noteadd_group/:id", urlencodedParser, (request, response) => {
  var header = request.body.header;
  var body_text = request.body.body_text;
  var end_date = new Date(request.body.due_dateG)
  var currentDate = new Date()
  if(end_date == "Invalid Date"){
    end_date = null
  }
  pool.query(`SELECT * FROM public.userdata WHERE username = $1`,[request.session.username] , (err, results)=>{
    pool.query(`INSERT INTO public.notedata VALUES (default, $1, $2, $3, $4, $5,$6)`,[header,body_text,currentDate,end_date,-1,request.params.id]);
  })
  response.redirect("/group_note/" + request.params.id);
  console.log("Create note on group id ",request.params.id)
});

app.get("/home",urlencodedParser,(req,res)=>{
  res.redirect("/webboard");
})


  app.post("/auth", urlencodedParser, (request, response) => {
    var username = request.body.username;
    var password = request.body.password;

    if (username && password) {

      pool.query(`SELECT * FROM public.userdata WHERE username = $1`,[username],(err, results) => {
          //console.log(results.rows);
  
        if (results.rows.length > 0) {
          const user = results.rows[0];
          //console.log(user.password,password);
       
  
            if (user.password == password) {
              request.session.loggedin = true;
              request.session.username = results.rows[0].username;
              response.redirect("/webboard");
              console.log("User ",results.rows[0].username," just logedin to website")

              var now = new Date()
              now.toString().substr(0, now.toString().indexOf(' GMT'))
              pool.query(`UPDATE public.userdata SET last_login = $1 WHERE username = $2`,[now,username]);

            } else {
              response.send("Incorret Username and/or Password!");
            }
            
          }
          else{
            response.send("Incorret Username and/or Password!");
          }
          response.end()
        })
    }else {
        response.send("Please enter Username and Password!");
        response.end();
    }
})

app.get("/signout", function(request, response){
    console.log(request.session.id," Just logedout from website")
    request.session.destroy(function (err) {
      response.send("Signout success")
        response.end();
    });
});

app.get("/group_note/:id",(request,response)=>{
  if (request.session.loggedin){
    pool.query(`SELECT * FROM public.userdata WHERE username = $1`,[request.session.username] , (err, resultss)=>{
      pool.query(`SELECT * FROM public.userdata` , (errr, user)=>{
        var group_idRe = request.params.id;
        pool.query(`SELECT * FROM public.notedata WHERE group_id = $1` ,[group_idRe], (err, results) => {
          pool.query(`SELECT * FROM public.group_data WHERE group_id = $1` ,[group_idRe], (err, join_group) => {
          console.log("Note add to group ",group_idRe);
          response.render("group_note.ejs", {
            group_id: group_idRe,
            note: results,
            users: user,
            joined_g: join_group,
            user: request.session.username
          })
        });
    });
  })
});
}else{
      response.send("Please Login First");
}
})


app.get("/group_select/",(request,response)=>{
  if (request.session.loggedin){
    pool.query(`SELECT * FROM public.userdata WHERE username = $1`,[request.session.username] , (err, resultss)=>{
      pool.query(`SELECT * FROM public.userdata` , (errr, user)=>{
          pool.query(`SELECT * FROM public.group_data WHERE $1 =ANY(joined_users)` ,[resultss.rows[0].user_id], (err, join_group) => {
          response.render("group_select.ejs", {
            users: user,
            joined_g: join_group,
            user: request.session.username
          })
        });
    });
  })

}else{
      response.send("Please Login First");
}
})

app.get("/webboard",function (request, response) {
    if (request.session.loggedin){
      pool.query(`SELECT * FROM public.userdata WHERE username = $1`,[request.session.username] , (err, resultss)=>{
        pool.query(`SELECT * FROM public.userdata` , (errr, user)=>{
          pool.query(`SELECT * FROM public.notedata WHERE owner = $1` ,[resultss.rows[0].user_id], (err, results) => {
            pool.query(`SELECT * FROM public.group_data WHERE $1 =ANY(joined_users)` ,[resultss.rows[0].user_id], (err, join_group) => {
              //console.log(join_group);
            response.render("webboard.ejs", {
              note: results,
              users: user,
              joined_g: join_group,
              user: request.session.username
            })
          });
      });
    })
  });
      
}else{
        response.send("Please Login First");

}});





  app.listen(port, () => {
    console.log(`App running on port ${port}.`)
  })

