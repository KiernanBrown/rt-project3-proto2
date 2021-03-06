let canvas;
let chatCanvas;
let ctx;
let chatCtx;

// our websocket connection
let socket;
let hash;
let user = '';
let prevTime;
let chatting = false;
let userChat = '';
const chatMessages = [];
const newMessages = [];
let roomName = '';
let tokens = [];
let players = {};
let canAct = false;
const unusedRoles = [];

let inGame = false;
let sleeping = false;
const sleepObj = {
  x: 0,
  y: -800,
  prevX: 0,
  prevY: -800,
  destX: 0,
  destY: -800,
  alpha: 1.0,
};

let screenMessage = {};

const lerp = (v0, v1, alpha) => ((1 - alpha) * v0) + (alpha * v1);

const wrapText = (chat, text, x, startY, width, lineHeight) => {
  // Code based on this tutorial:
  // https://www.html5canvastutorials.com/tutorials/html5-canvas-wrap-text-tutorial/
  const words = text.split(' ');
  let line = '';
  let y = startY;

  // Loop through each word in our message
  // Check if the line's width goes over when adding the line
  for (let i = 0; i < words.length; i++) {
    const testLine = `${line}${words[i]} `;
    const lineWidth = chat.measureText(testLine).width;
    if (lineWidth > width && i > 0) {
      chat.fillText(line, x, y);
      line = `${words[i]} `;
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  chat.fillText(line, x, y);
  return y;
};

// Draw chat messages to the screen
const drawMessages = () => {
  // Draw all chat messages on the side
  chatCtx.fillStyle = 'black';
  chatCtx.font = '18px Helvetica';
  let currentY = 20;
  for (let i = chatMessages.length - 1; i >= 0; i--) {
    currentY = wrapText(chatCtx, chatMessages[i], 2, currentY, 300, 20) + 30;
  }
};

const drawChat = () => {
  // Draw the message the user is typing
  const messageText = `${user}: ${userChat}`;
  ctx.fillStyle = 'black';
  ctx.font = '18px Helvetica';
  ctx.fillText(messageText, 20, 20);
  
  drawMessages();
};

// Draw any newly posted messages to the screen
// Newly sent messages stay on screen for 5 seconds
const drawNewMessages = () => {
  chatCtx.fillStyle = 'black';
  chatCtx.font = '18px Helvetica';
  let currentY = 20;
  for (let i = newMessages.length - 1; i >= 0; i--) {
    currentY = wrapText(chatCtx, newMessages[i], 2, currentY, 300, 20) + 30;
  }
};

const setPosition = (pHash, x, y) => {
  const p = players[pHash];

  p.x = x;
  p.y = y + 100;
};

const drawRoundRect = (x, y, size, cornerRadius) => {
  ctx.beginPath();
  ctx.moveTo((x - size) + cornerRadius, y - size);
  ctx.lineTo((x + size) - cornerRadius, y - size);
  ctx.arcTo(x + size, y - size, x + size, (y - size) + cornerRadius, cornerRadius);
  ctx.lineTo(x + size, (y + size) - cornerRadius);
  ctx.arcTo(x + size, y + size, (x + size) - cornerRadius, y + size, cornerRadius);
  ctx.lineTo((x - size) + cornerRadius, y + size);
  ctx.arcTo(x - size, y + size, x - size, (y + size) - cornerRadius, cornerRadius);
  ctx.lineTo(x - size, (y - size) + cornerRadius);
  ctx.arcTo(x - size, y - size, (x - size) + cornerRadius, y - size, cornerRadius);
};

const drawRoleCard = (x, y, role, flipped) => {
  if (!flipped) {
    ctx.fillStyle = 'rgba(170, 170, 170, 0.6)';
    drawRoundRect(x, y, 45, 4);
    ctx.fill();
    ctx.stroke();
  } else {
    if (role === 'Villager' || role === 'Seer' || role === 'Robber' || role === 'Revealer' || role === 'Insomniac') ctx.fillStyle = 'rgba(125, 168, 237, 0.8)';
    else if (role === 'Werewolf') ctx.fillStyle = 'rgba(193, 62, 42, 0.8)';
    else ctx.fillStyle = 'rgba(140, 140, 140, 0.8)';

    const cardText = role.substring(0, 3);
    drawRoundRect(x, y, 45, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'black';
    ctx.font = '20px Helvetica';
    ctx.fillText(cardText, x - (ctx.measureText(cardText).width / 2), y - 10);
  }
};

const drawPlayer = (pHash) => {
  const p = players[pHash];

  // Draw the card of the player
  // Rounded rectangle tutorial: https://www.html5canvastutorials.com/tutorials/html5-canvas-rounded-corners/
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 3;
  if (!p.flipped) {
    drawRoleCard(p.x, p.y, p.role, p.flipped);
  }

  // Draw the player
  // This will be updated to display in the player's color or their icon
  ctx.fillStyle = 'rgba(240, 240, 240, 1.0)';
  ctx.beginPath();
  ctx.arc(p.x, p.y, 30, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // If a player's card has been flipped, we display it on top of them
  if (p.flipped) {
    drawRoleCard(p.x, p.y, p.role, p.flipped);
  }

  // Write the player's name under them
  ctx.fillStyle = 'black';
  ctx.font = '18px Helvetica';
  ctx.fillText(p.name, p.x - (ctx.measureText(p.name).width / 2), p.y + 62);
};

const drawPlayers = () => {
  const keys = Object.keys(players);
  for (let i = 0; i < keys.length; i++) {
    drawPlayer(keys[i]);
  }
};

const drawUnusedRoles = () => {
  if (unusedRoles.length > 0) {
    drawRoleCard(unusedRoles[0].x, unusedRoles[0].y, unusedRoles[0].role, unusedRoles[0].flipped);
    drawRoleCard(unusedRoles[1].x, unusedRoles[1].y, unusedRoles[1].role, unusedRoles[1].flipped);
    drawRoleCard(unusedRoles[2].x, unusedRoles[2].y, unusedRoles[2].role, unusedRoles[2].flipped);
  }
};

const drawGame = (deltaTime) => {
  // Draw all the players in the game
  drawPlayers();

  // Draw the 3 unused Roles
  drawUnusedRoles();

  // Draw our sleepObj
  if (sleepObj.alpha < 1) {
    sleepObj.alpha += deltaTime / 10;
    sleepObj.y = lerp(sleepObj.prevY, sleepObj.destY, sleepObj.alpha);
  } else {
    sleepObj.y = sleepObj.destY;
  }
  ctx.fillStyle = 'black';
  ctx.fillRect(sleepObj.x, sleepObj.y, 600, 800);

  if (chatting) drawChat();
  else drawMessages();
  // if (chatting) drawChat();
  // else if (newMessages.length > 0) drawNewMessages();
};

const drawMenu = () => {
  // Draw our play button
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 5;
  ctx.fillStyle = 'green';
  ctx.fillRect(200, 200, 200, 140);
  ctx.strokeRect(200, 200, 200, 140);
  ctx.font = '32px Helvetica';
  ctx.fillStyle = 'black';
  ctx.fillText('Play', 300 - (ctx.measureText('Play').width / 2), 270);
};

const redraw = (time) => {  
  const deltaTime = (time - prevTime) / 100;
  prevTime = time;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  chatCtx.clearRect(0, 0, chatCanvas.width, chatCanvas.height);

  if (inGame) {
    drawGame(deltaTime);
  } else {
    drawMenu();
  }

  if (screenMessage) {
    if (screenMessage.alpha > 0) {
      if (screenMessage.disappear) {
        // Reduce the alpha if this message disappears
        screenMessage.alpha -= 0.003;
      }

      // Draw the message to the screen
      // https://www.w3schools.com/tags/canvas_measuretext.asp
      ctx.font = '32px Helvetica';
      ctx.fillStyle = `rgba(0, 0, 0, ${screenMessage.alpha})`;
      const textX = 300 - (ctx.measureText(screenMessage.message).width / 2);
      ctx.fillText(screenMessage.message, textX, 200);

      if (screenMessage.submessage) {
        ctx.font = '24px Helvetica';
        ctx.fillStyle = `rgba(0, 0, 0, ${screenMessage.alpha})`;
        const subtextX = 300 - (ctx.measureText(screenMessage.submessage).width / 2);
        ctx.fillText(screenMessage.submessage, subtextX, 240);
      }
    }
  }

  requestAnimationFrame(redraw);
};

const setPlayerPositions = () => {
  const keys = Object.keys(players);
  switch (keys.length) {
    case 1: setPosition(keys[0], canvas.width / 2.0, canvas.height / 2.0);
      break;
    case 2: setPosition(keys[0], canvas.width / 2.0, (canvas.height / 2.0) - 150);
      setPosition(keys[1], canvas.width / 2.0, (canvas.height / 2.0) + 150);
      break;
    case 3: setPosition(keys[0], canvas.width / 2.0, (canvas.height / 2.0) - 150);
      setPosition(keys[1], (canvas.width / 2.0) + 150, (canvas.height / 2.0) + 150);
      setPosition(keys[2], (canvas.width / 2.0) - 150, (canvas.height / 2.0) + 150);
      break;
    case 4: setPosition(keys[0], (canvas.width / 2.0) - 150, (canvas.height / 2.0) - 150);
      setPosition(keys[1], (canvas.width / 2.0) + 150, (canvas.height / 2.0) - 150);
      setPosition(keys[2], (canvas.width / 2.0) + 150, (canvas.height / 2.0) + 150);
      setPosition(keys[3], (canvas.width / 2.0) - 150, (canvas.height / 2.0) + 150);
      break;
    case 5: setPosition(keys[0], canvas.width / 2.0, (canvas.height / 2.0) - 150);
      setPosition(keys[1], (canvas.width / 2.0) + 150, (canvas.height / 2.0));
      setPosition(keys[2], (canvas.width / 2.0) + 80, (canvas.height / 2.0) + 150);
      setPosition(keys[3], (canvas.width / 2.0) - 80, (canvas.height / 2.0) + 150);
      setPosition(keys[4], (canvas.width / 2.0) - 150, (canvas.height / 2.0));
      break;
    case 6: setPosition(keys[0], (canvas.width / 2.0) - 80, (canvas.height / 2.0) - 150);
      setPosition(keys[1], (canvas.width / 2.0) + 80, (canvas.height / 2.0) - 150);
      setPosition(keys[2], (canvas.width / 2.0) + 150, (canvas.height / 2.0));
      setPosition(keys[3], (canvas.width / 2.0) + 80, (canvas.height / 2.0) + 150);
      setPosition(keys[4], (canvas.width / 2.0) - 80, (canvas.height / 2.0) + 150);
      setPosition(keys[5], (canvas.width / 2.0) - 150, (canvas.height / 2.0));
      break;
    case 7: setPosition(keys[0], (canvas.width / 2.0), (canvas.height / 2.0) - 190);
      setPosition(keys[1], (canvas.width / 2.0) + 130, (canvas.height / 2.0) - 100);
      setPosition(keys[2], (canvas.width / 2.0) + 200, (canvas.height / 2.0) + 50);
      setPosition(keys[3], (canvas.width / 2.0) + 80, (canvas.height / 2.0) + 190);
      setPosition(keys[4], (canvas.width / 2.0) - 80, (canvas.height / 2.0) + 190);
      setPosition(keys[5], (canvas.width / 2.0) - 200, (canvas.height / 2.0) + 50);
      setPosition(keys[6], (canvas.width / 2.0) - 130, (canvas.height / 2.0) - 100);
      break;
    case 8: setPosition(keys[0], (canvas.width / 2.0) - 75, (canvas.height / 2.0) - 200);
      setPosition(keys[1], (canvas.width / 2.0) + 75, (canvas.height / 2.0) - 200);
      setPosition(keys[2], (canvas.width / 2.0) + 200, (canvas.height / 2.0) - 75);
      setPosition(keys[3], (canvas.width / 2.0) + 200, (canvas.height / 2.0) + 75);
      setPosition(keys[4], (canvas.width / 2.0) + 75, (canvas.height / 2.0) + 200);
      setPosition(keys[5], (canvas.width / 2.0) - 75, (canvas.height / 2.0) + 200);
      setPosition(keys[6], (canvas.width / 2.0) - 200, (canvas.height / 2.0) + 75);
      setPosition(keys[7], (canvas.width / 2.0) - 200, (canvas.height / 2.0) - 75);
      break;
  }
};

const setUser = (data) => {
  ({ roomName } = data);
  const h = data.hash;
  hash = h;
  players[hash] = { name: data.name };
};

const addUser = (data) => {
  players[data.hash] = { name: data.name, hash: data.hash };
  setPlayerPositions();
};

const setPlayers = (data) => {
  ({ players } = data);
  setPlayerPositions();
};

const removeUser = (rHash) => {
  if (players[rHash]) {
    delete players[rHash];
  }
  setPlayerPositions();
};

const keyPressHandler = (e) => {
  if (chatting) {
    e.preventDefault();
    const keyPressed = e.which;

    userChat = `${userChat}${String.fromCharCode(keyPressed)}`;
  }
};

const keyDownHandler = (e) => {
  if (inGame) {
    const keyPressed = e.which;
    if (chatting) {
      if ((keyPressed === 8 || keyPressed === 46) && userChat.length > 0) {
        e.preventDefault();
        userChat = userChat.substr(0, userChat.length - 1);
        return;
      }
    }

    if (keyPressed === 13) {
      e.preventDefault();
      // Enter starts or ends chat
      if (chatting) {
        // Send the message to the server
        if (userChat !== '') {
          socket.emit('message', { sender: user, message: userChat, roomName });
        }
        userChat = '';
        chatting = false;
      } else {
        chatting = true;
      }
    }
  }
};

/* const mouseMoveHandler = (e) => {
  square.mouseX = e.pageX - canvas.offsetLeft;
  square.mouseY = e.pageY - canvas.offsetTop;
}; */

const addScreenMessage = (data) => {
  screenMessage = {
    message: data.message,
    submessage: data.submessage,
    disappear: data.disappear,
    alpha: 1.0,
  };
};

// Add a chat message to the client
const addChatMessage = (data) => {
  chatMessages.push(data);
  newMessages.push(data);
  setTimeout(() => { newMessages.splice(newMessages.indexOf(data), 1); }, 5000);
};

const sleep = () => {
  sleeping = true;
  sleepObj.alpha = 0;
  sleepObj.destY = 0;
  sleepObj.prevY = -800;
  for(let i = 0; i < unusedRoles.length; i++) {
    unusedRoles[i].flipped = false;
  }
};

const wake = () => {
  sleeping = false;
  sleepObj.alpha = 0;
  sleepObj.destY = -800;
  sleepObj.prevY = 0;
};

const flip = (data) => {
  const p = players[data.hash];
  p.flipped = data.flipped;
};

const flipAll = (data) => {
  const keys = Object.keys(players);
  for (let i = 0; i < keys.length; i++) {
    flip({ hash: keys[i], flipped: data.flipped });
  }
};

const setStartRole = (data) => {
  const p = players[data.hash];
  p.startRole = data.role;
  p.role = data.role;
};

const setRole = (data) => {
  const p = players[data.hash];
  p.role = data.role;
};

const setUnusedRoles = (data) => {
  const { roles } = data;
  for (let i = 0; i < roles.length; i++) {
    const x = (canvas.width / 4) * (i + 1);
    unusedRoles.push({
      role: roles[i],
      flipped: false,
      x,
      y: 100,
    });
  }
};

const connect = () => {
  socket = io.connect();
  
  socket.on('connect', () => {
    user = document.querySelector("#username").value;
                
    if(!user) {
      user = 'unknown';
    }
                
    socket.emit('join', { name: user });
  });

  socket.on('joined', setUser);

  socket.on('left', removeUser);

  socket.on('screenMessage', addScreenMessage);

  socket.on('addPlayer', addUser);

  socket.on('setPlayers', setPlayers);

  socket.on('addMessage', addChatMessage);

  socket.on('sleep', sleep);

  socket.on('wake', wake);

  socket.on('flip', flip);

  socket.on('flipAll', flipAll);

  socket.on('setStartRole', setStartRole);

  socket.on('setRole', setRole);

  socket.on('setUnusedRoles', setUnusedRoles);

  socket.on('changeAct', (data) => {
    canAct = data;
  });
};

const handleAction = (clickedObj) => {
  if (!canAct) return;
  if (players[hash].startRole === 'Werewolf') {
    if (clickedObj.hash || !clickedObj.role) return;

    canAct = false;
    unusedRoles[unusedRoles.indexOf(clickedObj)].flipped = true;
    clickedObj.flipped = true;
  }
  if (players[hash].startRole === 'Seer') {
    if (clickedObj.hash) {
      canAct = false;
      clickedObj.flipped = true;
    }
  }
  if (players[hash].startRole === 'Robber') {
    if (!clickedObj.hash) return;

    canAct = false;
    socket.emit('changeRole', { roomName, hash, newRole: clickedObj.role });
    socket.emit('changeRole', { roomName, hash: clickedObj.hash, newRole: 'Robber' });
    flip({ hash, flipped: true });
  }
  if (players[hash].startRole === 'Revealer') {
    if (!clickedObj.hash) return;

    canAct = false;
    if (clickedObj.role === 'Tanner' || clickedObj.role === 'Werewolf') {
      addScreenMessage({ message: 'The card could not be flipped!', submessage: 'This player is a Tanner or a Werewolf.' });
    } else {
      const pHash = clickedObj.hash;
      socket.emit('revealerFlip', { roomName, hash: pHash });
    }
  }
};

const checkPlayerClick = (mX, mY) => {
  const keys = Object.keys(players);
  for (let i = 0; i < keys.length; i++) {
    const player = players[keys[i]];
    if (mX >= player.x - 30 && mX <= player.x + 30) {
      if (mY >= player.y - 30 && mY <= player.y + 30) {
        return player;
      }
    }
  }
  return {};
};

const checkRoleClick = (mX, mY) => {
  for (let i = 0; i < unusedRoles.length; i++) {
    const card = unusedRoles[i];
    if (mX >= card.x - 50 && mX <= card.x + 50) {
      if (mY >= card.y - 50 && mY <= card.y + 50) {
        return card;
      }
    }
  }
  return {};
};

const mouseClickHandler = (e) => {
  const mouseX = e.pageX - canvas.offsetLeft;
  const mouseY = e.pageY - canvas.offsetTop;

  if (!inGame) {
    if (mouseX >= 200 && mouseX <= 400) {
      if (mouseY >= 200 && mouseY <= 340) {
        inGame = true;
        connect();
      }
    }
  } else {
    if (canAct) {
      const clickedPlayer = checkPlayerClick(mouseX, mouseY);
      if (clickedPlayer) handleAction(clickedPlayer);
      const clickedRole = checkRoleClick(mouseX, mouseY);
      if (clickedRole) handleAction(clickedRole);
    }
    
  }
};

const init = () => {
  canvas = document.querySelector('#canvas');
  ctx = canvas.getContext('2d');
  chatCanvas = document.querySelector('#chatCanvas');
  chatCtx = chatCanvas.getContext('2d');

  document.body.addEventListener('keydown', keyDownHandler);
  document.body.addEventListener('keypress', keyPressHandler);
  // canvas.addEventListener('mousemove', mouseMoveHandler);
  canvas.addEventListener('click', mouseClickHandler);
  // chatCanvas.addEventListener('mousemove', mouseMoveHandler);
  chatCanvas.addEventListener('click', mouseClickHandler);

  requestAnimationFrame(redraw);
};

window.onload = init;
