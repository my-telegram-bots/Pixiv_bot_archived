const request = require('request');
const promise = require('promise'); 
const fs = require('fs');
const unzip = require('unzip');
const {exec} = require('child_process');
const PixivApi = require('pixiv-api-client');
const pixiv = new PixivApi();
const utils = require('utility');
const mysql = require('mysql');
let config = require('./config.json');
const connection = mysql.createConnection({
    host: config.mysql.host,
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database,
    charset: 'utf8mb4'
});
connection.connect();
requesttgapi('getMe').then(function(res) {
    config.bot.username = res.result.username;
    config.bot.id = res.result.id;
    config.bot.name = res.result.first_name;
    console.log(res.result);
    if(config.pixiv.refresh_token === ''){
        pixiv.login(config.pixiv.username, config.pixiv.password).then(function(a){
            console.log(a);
            config.pixiv.refresh_token = a.refresh_token;
            fs.writeFileSync('config.json',JSON.stringify(config));
        });
    }else{
        pixiv.refreshAccessToken(config.pixiv.refresh_token);
    }
    setInterval(function(){
        pixiv.refreshAccessToken();
    },60*1000*60);
    poll();
});
function poll(offset) {
    try {
        request('https://api.telegram.org/bot' + config.bot.token + '/getUpdates?offset=' + offset, function (error, response, body) {
        if(error){
            console.error(error);
            setTimeout(poll(offset),config.bot.poll_time);
        }else if(JSON.parse(body).ok)
            run(JSON.parse(body).result);
        else
            console.error('bad token');
        });    
    } catch (e) {
        console.error(e);
        poll();
    }
}
function run(msg){
    let offset = '';
    if(msg[msg.length-1] !== undefined)
        offset = msg[msg.length-1].update_id+1;
    setTimeout(function () {
        poll(offset);
    },1000);
    msg.forEach(function(query) {
        if(query.message){
            if (query.message !== null)
                domessage(query.message);
        }else if(query.inline_query !== undefined){
            doinline(query.inline_query);
        }
    });
}
function doinline(inline_query) {
    let query_id = inline_query.id;
    let query = inline_query.query;
    let offset = inline_query.offset;
    let user_id = inline_query.from.id;
    let unixtime = Math.floor(new Date().getTime()/1000);
    let inline = [];
    let share = true;
    let tags = false;
    if(query.indexOf('+tags')>-1){
        tags = true;
    }
    if(query.indexOf('-share')>-1){
        share = false;
    }
    query = query.replace('-share','').replace('+tags','');
    console.log(new Date() + ' ' + inline_query.from.first_name + ' ' + inline_query.from.last_name+ '->' + user_id + '->' + query);
    let id = /[0-9]{8}/.test(query) ? /[0-9]{8}/.exec(query)[0] : false;
    if(id){
        getillust(id,user_id).then(function(data){
            for (let i = 0; i < data.imgurl[1].length; i++) {
                inline.push({
                    id: id + '_' + i,
                    type: 'photo',
                    photo_url: data.imgurl[1][i],
                    thumb_url: data.imgurl[0][i],
                    caption: data.title + (data.imgurl[0].length > 1 ? '->' + (i+1) + '/' + data.imgurl[1].length : '') + '\n',
                    reply_markup: genkeyboard(id,share,(data.imgurl[0].length > 1 ? true : false))
                });
                if(tags){
                    let t = '';
                    (data.tags).forEach(tag=>{
                        t += '#' + tag.name+' ';
                    })
                    inline[inline.length-1].caption += t;
                }
            }
            if(data.isugoira){
                if(data.ugoira_file_id === null){
                    requesttgapi('answerInlineQuery',{
                        inline_query_id: query_id,
                        cache_time: 0,
                        switch_pm_text: 'Click me to generate mp4',
                        switch_pm_parameter: id
                    });
                    return true;
                }else{
                    inline.push({
                        id: id + '_0',
                        type: 'mpeg4_gif',
                        mpeg4_file_id: data.ugoira_file_id,
                        caption: data.title + '\n',
                        reply_markup: genkeyboard(id,share,(data.imgurl[0].length > 1 ? true : false))
                    });
                }
                if(tags){
                    let t = '';
                    (data.tags).forEach(tag=>{
                        t += '#' + tag.name+' ';
                    })
                    inline[inline.length-1].caption += t;
                }
            }
            
            requesttgapi('answerInlineQuery',{
                inline_query_id: query_id,
                results: JSON.stringify(inline)
            });
        });
    }else if(offset !== ''){
        connection.query('SELECT * FROM `Pixiv_bot_cache` WHERE `query` = ? AND `offset`= ? AND `time` > ?',[query,offset,unixtime-86400], function (error, results, fields) {
            if(results.length > 0){
                if(results[0].next_url === '-'){
                    requesttgapi('answerInlineQuery',{
                        inline_query_id: query_id,
                        cache_time: config.bot.cache_time,
                        results: JSON.stringify(inlineimge(JSON.parse(results[0].results),share,tags))
                    });
                }else{
                    requesttgapi('answerInlineQuery',{
                        inline_query_id: query_id,
                        cache_time: config.bot.cache_time,
                        next_offset: results[0].next_offset,
                        results: JSON.stringify(inlineimge(JSON.parse(results[0].results),share,tags))
                    });
                }
            }else{
                connection.query('SELECT * FROM `Pixiv_bot_cache` WHERE `query` = ? AND `next_offset`= ? AND `time` > ?',[id,offset,unixtime-86400], function (error, results, fields) {
                    pixiv.requestUrl(results[0].next_url).then(pixdata => {
                        if(pixdata.next_url === null)
                                pixdata.next_url = '-';
                        let next_offset = utils.md5(pixdata.next_url);
                        if(pixdata.next_url === null){
                            requesttgapi('answerInlineQuery',{
                                inline_query_id: query_id,
                                cache_time: config.bot.cache_time,
                                results: JSON.stringify(inlineimge(pixdata.illusts,share,tags))
                            });
                        }else{
                            requesttgapi('answerInlineQuery',{
                                inline_query_id: query_id,
                                cache_time: config.bot.cache_time,
                                next_offset: next_offset,
                                results: JSON.stringify(inlineimge(pixdata.illusts,share,tags))
                            });
                        }
                        connection.query('INSERT INTO `Pixiv_bot_cache` (`user_id`, `query`, `offset`, `next_offset`,`results`, `time`,`next_url`) VALUES (?, ?, ?, ?, ?, ?,?)',[user_id,query,offset,next_offset,JSON.stringify(pixdata.illusts),unixtime,pixdata.next_url], function (error, results, fields) {
                            if(error)
                                console.error(error);
                        });
                    });
                });
            }
        })
    }else{
        connection.query('SELECT * FROM `Pixiv_bot_cache` WHERE `query` = ? AND `offset`= ? AND `time` > ?',[query,'',unixtime-86400], function (error, results, fields) {
            if(results.length > 0){
                requesttgapi('answerInlineQuery',{
                    inline_query_id: query_id,
                    cache_time: config.bot.cache_time,
                    next_offset: results[0].next_offset,
                    results: JSON.stringify(inlineimge(JSON.parse(results[0].results),share,tags))
                });
            }else{
                if(query == ''){
                    pixiv.illustRanking().then(pixdata=>{
                        let next_offset = utils.md5(pixdata.next_url);   
                        connection.query('INSERT INTO `Pixiv_bot_cache` (`user_id`, `query`, `offset`, `next_offset`,`results`, `time`,`next_url`) VALUES (?, ?, ?, ?, ?,?,?)',[user_id,query,offset,next_offset,JSON.stringify(pixdata.illusts),unixtime,pixdata.next_url], function (error, results, fields) {
                            if(error)
                                console.error(error);
                        });
                        requesttgapi('answerInlineQuery',{
                            inline_query_id: query_id,
                            cache_time: config.bot.cache_time,
                            next_offset: next_offset,
                            results: JSON.stringify(inlineimge(pixdata.illusts,share,tags))
                        });
                    });
                }else{
                    pixiv.searchIllust(query).then(pixdata => {
                        if(pixdata.next_url === null)
                            pixdata.next_url = '-';
                        let next_offset = utils.md5(pixdata.next_url);
                        connection.query('INSERT INTO `Pixiv_bot_cache` (`user_id`, `query`, `offset`, `next_offset`,`results`, `time`,`next_url`) VALUES (?, ?, ?, ?, ?,?,?)',[user_id,query,offset,next_offset,JSON.stringify(pixdata.illusts),unixtime,pixdata.next_url], function (error, results, fields) {
                            if(error)
                                console.error(error);
                            requesttgapi('answerInlineQuery',{
                                inline_query_id: query_id,
                                cache_time: config.bot.cache_time,
                                next_offset: next_offset,
                                results: JSON.stringify(inlineimge(pixdata.illusts,share,tags))
                            });
                        });
                    });
                }
            }
        });
    }
}
function domessage(message) {
    let chat_id = message.chat.id;
    let user_id = message.from.id;
    let message_id = message.message_id;
    let text = message.text || '';
    let id = /[0-9]{8}/.test(text) ? /[0-9]{8}/.exec(text)[0] : false;
    let rmusernametext = text.replace("@"+config.bot.username,'');
    let otext = rmusernametext.split(' ');
    let share = true;
    let tags = false;
    if(text.indexOf('+tags')>-1){
        tags = true;
    }
    if(text.indexOf('-share')>-1){
        share = false;
    }
    text = text.replace('-share','').replace('+tags','');
    console.log(new Date() + ' ' + message.from.first_name + ' ' + message.from.last_name+ '->' + user_id + '->' + text);
    console.log(id);
    if(id){
        getillust(id,user_id).then(function(data){
            for (var i = 0; i < data.imgurl[1].length; i++) {
                requesttgapi('SendPhoto',{
                    chat_id: chat_id,
                    photo: data.imgurl[1][i],
                    reply_to_message_id: message_id,
                    caption: data.title + (data.imgurl[1].length > 1 ? (' ' + (i + 1) + '/' + data.imgurl[1].length) : ''),
                    reply_markup: JSON.stringify(genkeyboard(id,share,(data.imgurl[0].length > 1 ? true : false)))
                });
            }
            if(data.isugoira === 1){
                if(data.ugoira_file_id === null){
                    pixiv.ugoiraMetaData(id).then(pixdata => {
                        if(fs.existsSync('./file/mp4_1/' + id + '.mp4'))
                            fs.unlinkSync('./file/mp4_1/' + id + '.mp4');
                        if(fs.existsSync('./file/mp4_2/' + id + '.mp4'))
                        fs.unlinkSync('./file/mp4_2/' + id + '.mp4');
                        let frame = '# timecode format v2\n0\n';
                        let tempframe = 0;
                        (pixdata.ugoira_metadata.frames).forEach(function(element) {
                            tempframe += element.delay;
                            frame += tempframe + "\n";
                        }, this);
                        fs.writeFileSync('./file/timecode/'+id+'.txt',frame);
                        request({
                            url: pixdata.ugoira_metadata.zip_urls.medium,
                            headers: {
                                'referer': 'https://www.pixiv.net'
                            }
                        },function (){
                            try{
                                exec('ffmpeg -i ./file/ugoira/'+id+'/%6d.jpg -c:v libx264 -vf "format=yuv420p,scale=trunc(iw/2)*2:trunc(ih/2)*2" ./file/mp4_1/'+id+'.mp4',{timeout:60*1000}, (error, stdout, stderr) => {
                                    if (error)
                                        console.error(error);
                                    else
                                        exec('mp4fpsmod -o ./file/mp4_2/'+id+'.mp4 -t ./file/timecode/'+id+'.txt ./file/mp4_1/'+id+'.mp4',{timeout:60*1000}, (error, stdout, stderr) => {
                                            if(error)
                                                console.error(error);
                                            else
                                                requesttgapi('sendAnimation',{
                                                    chat_id: chat_id,
                                                    up: 'animation',
                                                    filepath: './file/mp4_2/'+id+'.mp4',
                                                    reply_to_message_id: message_id,
                                                    caption: data.title + (data.imgurl[1].length > 1 ? (' ' + (i + 1) + '/' + data.imgurl[1].length) : ''),
                                                    reply_markup: JSON.stringify(genkeyboard(id,share,(data.imgurl[0].length > 1 ? true : false)))
                                                }).then(res => {                                    
                                                    connection.query('UPDATE `Pixiv_bot_illust` SET `ugoira_file_id` = ? WHERE `illust_id` = ?',[res.file_id,id]);
                                                });
                                        });
                                    });
                            }catch(error){
                                requesttgapi('SendMessage',{
                                    chat_id: config.bot.masterid,
                                    text: 'Convert error\n'+error
                                });
                                requesttgapi('SendMessage',{
                                    chat_id: chat_id,
                                    reply_to_message_id: message_id,
                                    text: 'Internal error.\nPlease try again later.'
                                });
                            }
                        }).pipe(unzip.Extract({path: './file/ugoira/'+id})); 
                    });
                }else{
                    requesttgapi('sendAnimation',{
                        chat_id: chat_id,
                        animation: data.ugoira_file_id,
                        reply_to_message_id: message_id,
                        caption: data.title + (data.imgurl[1].length > 1 ? (' ' + (i + 1) + '/' + data.imgurl[1].length) : ''),
                        reply_markup: JSON.stringify(genkeyboard(id,share,(data.imgurl[0].length > 1 ? true : false)))
                    });
                }
            }
        });
    }else{
        switch (otext[0]) {
            case '/start':
                requesttgapi('SendMessage',{
                    chat_id: chat_id,
                    text: 'Welcome to the unofficial Pixiv bot.\nSimply send a link with "illust" (e.g. https://www.pixiv.net/member_illust.php?mode=medium&illust_id=70374431) from Pixiv and I\'ll show you the pic.\nYou can also send me a Pixiv url to fetch image and converted ugoira.',
                    reply_to_message_id: message_id,
                    disable_web_page_preview: true
                }).then(res=>{
                    setTimeout(() => {
                        requesttgapi('SendMessage',{
                            chat_id: chat_id,
                            text: 'Let\'s get started!',
                        })
                    }, 500);
                })
                break;
            default:
                break;
        }
    }
}
function requesttgapi(type,value) {
    let data = value;
    let postdata = {form:data};
    if (value !== undefined && value.up !== undefined){
        data[value.up] = fs.createReadStream(__dirname + '/' +data.filepath);
        postdata = {formData: data};
    }
    return new promise(function(cb,err) {
        request.post('https://api.telegram.org/bot' + config.bot.token + '/' + type,postdata,function (error, response, body) {
            try {
                if(error)
                    console.error(error);
                else if(!JSON.parse(body).ok)
                    requesttgapi('SendMessage',{
                        chat_id: config.bot.masterid,
                        text: 'Request tg api error\n' + body
                    });
                else{
                    body = JSON.parse(body);
                    if (value !== undefined && value.up !== undefined)
                        body.file_id = body.result.document.file_id;
                    cb(body);
                }
            } catch (e) {
                console.error('tg api boom! or network boom\n'+e,body);
            }
        });
  });
};
function getillust(id,user_id){
    return new promise(function(cb,err) {
        let imgurl =[[],[]];
        let data = {};
        connection.query('SELECT * FROM `Pixiv_bot_illust` WHERE `illust_id` = ?',[id], function (error, results, fields) {
            if(results.length > 0){
                imgurl[0] = JSON.parse(results[0].thumb_url);
                imgurl[1] = JSON.parse(results[0].original_url);
                data.title = results[0].title;
                data.tags = JSON.parse(results[0].tags);
                data.imgurl = imgurl;
                data.isugoira = results[0].ugoira;
                data.ugoira_file_id = results[0].ugoira_file_id;
                cb(data);
            }else{
                pixiv.illustDetail(id).then(pixdata => {
                    let illust = pixdata.illust;
                    let isugoira = 0;
                    if(illust.type === 'illust')
                        if(illust.page_count === 1){
                            imgurl[0][0] = illust.image_urls.medium;
                            imgurl[1][0] = illust.meta_single_page.original_image_url;
                        }else{
                            for (var i = 0; i < (illust.meta_pages).length; i++) {
                                let img = illust.meta_pages[i];
                                imgurl[0][i] = img.image_urls.medium;
                                imgurl[1][i] = img.image_urls.original;
                            }
                        }
                    else if(illust.type === 'ugoira')
                        isugoira = 1;
                    connection.query('INSERT INTO `Pixiv_bot_illust` (`illust_id`, `user_id`, `title`, `ugoira`, `thumb_url`, `original_url`, `width`, `height`, `author_id`, `tags`, `caption`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);', [id, user_id, illust.title, isugoira, JSON.stringify(imgurl[0]), JSON.stringify(imgurl[1]), illust.width, illust.height, illust.user.id, JSON.stringify(illust.tags), illust.caption], function (error, results, fields) {
                        if(error)
                        console.error(error);
                    });
                    data.title = illust.title;
                    data.tags = illust.tags;
                    data.imgurl = imgurl;
                    data.isugoira = isugoira;
                    data.tags = illust.tags;
                    data.ugoira_file_id = null;
                    cb(data);
                });
            }
        });
    });
}
function inlineimge(illusts,share,tags){
    let imgurl = [];
    let inline = [];
    for (let i = 0; i < illusts.length; i++) {
        let illust = illusts[i];
        let p = false;
        if(illust.type === 'illust'){ // No ugoira
            if(illust.page_count === 1){
                imgurl[0] = illust.image_urls.medium;
                imgurl[1] = illust.meta_single_page.original_image_url;
            }else{
                // only show illust[0] image
                imgurl[0] = illust.meta_pages[0].image_urls.medium;
                imgurl[1] = illust.meta_pages[0].image_urls.original;
                p = '1/' + illust.meta_pages.length;
            }
            inline.push({
                id: illust.id + '_0',
                type: 'photo',
                photo_url: imgurl[1],
                thumb_url: imgurl[0],
                caption: illust.title + '->' + (p ? p:''),
                photo_width: illust.width,
                photo_height: illust.height,
                reply_markup: genkeyboard(illust.id,share,p)
            });
            if(tags){
                let t = '';
                (illust.tags).forEach(tag=>{
                    t += '#' + tag.name+' ';
                })
                inline[inline.length-1].caption = illust.title + '\n' + t;
            }
        }
    }
    return inline;
}
function genkeyboard(id,share,p) {
    let inline_keyboard = {
        inline_keyboard:[
            [
            ]
        ]
    };
    if(p)
        inline_keyboard.inline_keyboard[0].push({
            text: 'open',
            url: 'https://www.pixiv.net/member_illust.php?mode=manga&illust_id='+id
        });
    else
        inline_keyboard.inline_keyboard[0].push({
            text: 'open',
            url: 'https://www.pixiv.net/member_illust.php?mode=medium&illust_id='+id
        });
    if(share)
        inline_keyboard.inline_keyboard[0].push({
            text: 'share',
            switch_inline_query: id.toString()
        });
    return inline_keyboard;
}