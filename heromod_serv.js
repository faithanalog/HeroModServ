var net = require('net');
var crypto = require('crypto');

var players = [];

function Player(name, socket) {
    this.name = name;
    this.health = 0;
    this.mana = 0;
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.partyMembers = [];
    this.socket = socket;

    //Initial party hash
    var sum = crypto.createHash('sha256');
    sum.update(name + Math.random());
    this.partyHash = sum.digest('base64');
}

function HealthPacket(player) {
    this.name = player.name;
    this.hp = player.hp;
}

function ManaPacket(player) {
    this.name = player.name;
    this.mana = player.mana;
}

function PositionPacket(player) {
    this.name = player.name;
    this.x = player.x;
    this.y = player.y;
    this.z = player.z;
}

function NameMap(partial, full) {
    this.name = partial;
    this.fullName = full;
}

function changePosition(player, x, y, z) {
    player.x = x;
    player.y = y;
    player.z = z;
    sendDataToParty(player, JSON.stringify(new PositionPacket(player)));
}

function changeHealth(player, hp) {
    player.health = hp;
    sendDataToParty(player, JSON.stringify(new HealthPacket(player)));
}

function changeMana(player, mana) {
    player.mana = mana;
    sendDataToParty(player, JSON.stringify(new ManaPacket(player)));
}

function changeMembers(player, newMems) {
    newMems.sort();
    player.partyMembers = newMems;
    var sum = crypto.createHash('sha256');
    sum.update(player.partyMembers.join('|'));
    player.partyHash = sum.digest('base64');
}

//Gets the full name of a party member of <player>
function getFullName(player, partialName) {
    var oPlayer;
    for (var i = 0; i < players.length; i++) {
        oPlayer = players[i];
        if (oPlayer.partyHash === player.partyHash &&
                oPlayer.name.indexOf(partialName) === 0) {
            return oPlayer.name;
        }
    }
    return partialName;
}

function sendDataToParty(player, dataStr) {
    var partyHash = player.partyHash,
        oPlayer;
    for (var i = 0; i < players.length; i++) {
        oPlayer = players[i];
        if (oPlayer !== player && oPlayer.partyHash === partyHash) {
            oPlayer.socket.write(dataStr);
        }
    }
}

var serv = net.createServer(function(sock) {
    sock.setNoDelay(true);
    var player = null;

    function playerLeave() {
        if (player) {
            var index = players.indexOf(player);
            players.splice(index, 1);
            player = null;
        }
    }

    sock.on('data', function(dataStr) {
        var pkt, p, pos, hp, mana;
        try {
            pkt = JSON.parse(dataStr);
        } catch (e) {
            return;
        }
        if (pkt.type === "JOIN") {
            player = new Player(pkt.name, sock);
            changeMembers(player, pkt.partyMembers);
            changePosition(player, pkt.x, pkt.y, pkt.z);
            changeHealth(player, pkt.hp);
            changeMana(player, pkt.mana);
            for (var i = 0; i < players.length; i++) {
                p = players[i];
                if (p.partyHash === player.partyHash) {
                    pos = new PositionPacket(p);
                    hp = new HealthPacket(p);
                    mana = new ManaPacket(p);
                    sock.write(JSON.stringify(pos));
                    sock.write(JSON.stringify(hp));
                    sock.write(JSON.stringify(mana));
                }
            }
            players.push(player);

        }
        if (pkt.type === "LEAVE") {
            playerLeave();
        }
        if (!player) {
            return;
        }
        switch (pkt.type) {
        case "POS":
            changePosition(player, pkt.x, pkt.y, pkt.z);
            break;
        case "MEMS":
            changeMembers(player, pkt.partyMembers);
            break;
        case "HP":
            changeHealth(player, pkt.hp);
            break;
        case "MANA":
            changeMana(player, pkt.mana);
            break;
        case "GET_NAME":
            var map = new NameMap(pkt.partialName, getFullName(player, pkt.partialName));
            var json = JSON.stringify(map);
            sock.write(json);
            break;
        }
    });

    sock.on('end', function() {
        //Client disconnect
        playerLeave();
    });

    sock.on('error', function(err) {
        playerLeave();
    });
});

serv.listen(4070);
