'use strict'

//var log4js = require('log4js');
var http = require('http');
var https = require('https');
var fs = require('fs');
var socketIo = require('socket.io');

var express = require('express');
var serveIndex = require('serve-index');

var USERCOUNT = 2;

// log4js.configure({
//     appenders: {
//         file: {
//             type: 'file',
//             filename: 'app.log',
//             layout: {
//                 type: 'pattern',
//                 pattern: '%r %p - %m',
//             }
//         }
//     },
//     categories: {
//        default: {
//           appenders: ['file'],
//           level: 'debug'
//        }
//     }
// });

// var logger = log4js.getLogger();

var app = express();
app.use(serveIndex('./public'));
app.use(express.static('./public'));

//http server
var http_server = http.createServer(app);
http_server.listen(8080, '0.0.0.0');

// https server
var options = {
	key : fs.readFileSync('./public/cert/xingm.pc.key'),
	cert: fs.readFileSync('./public/cert/xingm.pc.crt')
}
var https_server = https.createServer(options, app);
https_server.listen(8443, '0.0.0.0');
var io = socketIo.listen(https_server);

io.sockets.on('connection', (socket)=> {

	socket.on('send-ice', (room, data)=>{
		console.log(`[send-ice]: ${data}`);
		socket.to(room).emit('recv-ice', data);
	});

	socket.on('caller-send-sdp', (room, data)=>{
		console.log(`[caller-send-sdp]: ${data}`);
		socket.to(room).emit('receiver-recv-sdp', data);
	});

	socket.on('receiver-send-sdp', (room, data)=>{
		console.log(`[receiver-send-sdp]: ${data}`);
		socket.to(room).emit('caller-recv-sdp', data);
	});

	socket.on('join', (room)=>{
		var myRoom = io.sockets.adapter.rooms[room]; 
		var users = (myRoom)? Object.keys(myRoom.sockets).length : 0;
		console.log('the user number of room (' + room + ') is: ' + users);
		if(users < USERCOUNT) {
		    socket.join(room);
			socket.emit('joined', room); //发给自己
		    //io.in(room).emit('message', room, msg); //发给房间内的所有人
		    //socket.emit('message', room, msg); //发给房间内的所有人
		    //socket.broadcast.emit('message', room, msg); //发给房间内的所有人
		
		} else {
			socket.emit('full', room);
            var msg = 'room:' + room + ' is full';
			console.log(msg);
		}
	});
});



