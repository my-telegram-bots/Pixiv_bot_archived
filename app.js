let request=require('request');
let promise=require('promise'); 
let async=require('async');
let fs=require('fs');
let PixivApi=require('pixiv-api-client');
let unzip=require('unzip');
let {exec}=require('child_process');
let pixiv=new PixivApi();
let utils=require('utility');
let cheerio=require('cheerio');
let config=require('./config.json');
let api=require('tg-yarl')(config.bot.token);
let pixdaily=[];
let mysql=require('mysql');
let connection=mysql.createConnection({
    host:config.mysql.host,
    user:config.mysql.user,
    password:config.mysql.password,
    database:config.mysql.database,
    charset:'utf8mb4'
});
connection.connect();
api.getMe().then(function(val) {
    config.bot.username=val.body.result.username;
    config.bot.id=val.body.result.id;
    config.bot.name=val.body.result.first_name;
    console.log(val.body.result);
    if(config.pixiv.refresh_token===''){
        pixiv.login(config.pixiv.username, config.pixiv.password).then(function(a){
            console.log(a);
            config.pixiv.refresh_token=a.refresh_token;
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
        request('https://api.telegram.org/bot'+config.bot.token+'/getUpdates?offset='+offset, function (error, response, body) {
        if(error){
            console.error(error);
            setTimeout(poll(offset),1000);
        }else if(JSON.parse(body).ok)
            run(JSON.parse(body).result);
        else   
            console.error('bad config.bot.token or limit');
        });    
    } catch (e) {
        poll();
    }
}
function run(msg){
    let offset="";
    if(msg[msg.length-1]!==undefined)
        offset=msg[msg.length-1].update_id+1;
    setTimeout(function () {
        poll(offset);
    },1000);
    msg.forEach(function(query) {
        if(query.message){
            if (query.message!==null)
                domessage(query.message);
        }else if(query.inline_query!==undefined){
            doinline(query.inline_query);
        }
    });
}
//
function genkeyboard(id,sharebtn,p) {
    let inline_keyboard={inline_keyboard:[[]]};
    if(p===undefined)
        inline_keyboard.inline_keyboard[0].push({
            text:'open',
            url:'https://www.pixiv.net/member_illust.php?mode=medium&illust_id='+id
        });
    else
        inline_keyboard.inline_keyboard[0].push({
            text:'open',
            url:'https://www.pixiv.net/member_illust.php?mode=manga&illust_id='+id
        });
    if(sharebtn===undefined || sharebtn)
        inline_keyboard.inline_keyboard[0].push({
            text:'share',switch_inline_query:id.toString()//+'_'+p
        });
    return inline_keyboard;
}
function workillusts(illusts,sharebtn,addtags) {
    let img=[];
    let inline=[];
    illusts.forEach(function(illust) {
        if((illust.meta_single_page.original_image_url!==undefined)  && (illust.meta_single_page.original_image_url.indexOf('ugoira')>-1)){
        }else{
            if((illust.image_urls.square_medium!==undefined) && (illust.meta_single_page.original_image_url!==undefined)){
                img[0]=illust.image_urls.square_medium;
                img[1]=illust.meta_single_page.original_image_url;
            }else{
                img[0]=illust.meta_pages[0].image_urls.square_medium;
                img[1]=illust.meta_pages[0].image_urls.original;
            }
            if(addtags){
                illust.title+='\n';
                (illust.tags).forEach(function(tag) {
                    illust.title+='#'+tag['name']+' ';
                }, this);
            }
            inline.push({
                id:illust.id.toString(),
                type: 'photo',
                photo_url: img[1].replace('https://i.pximg.net',config.proxyurl),
                thumb_url: img[1].replace('https://i.pximg.net',config.proxyurl),
                caption: illust.title,
                photo_width:illust.width,
                photo_height:illust.height,
                reply_markup:genkeyboard(illust.id,sharebtn)
            });
        }
    }, this);
    //console.log(inline);
    return inline;
}
function doinline(inline_query) {
    let query_id=inline_query.id;
    let query=inline_query.query;
    let offset=inline_query.offset;
    let user_id=inline_query.from.id;
    let unixtime=Math.floor(new Date().getTime()/1000);
    let inline=[];
    let id=query.match(new RegExp(/[0-9]{8}/ig)); //正则可能有问题
    console.log(new Date()+' '+inline_query.from.first_name+' '+inline_query.from.last_name+'->'+user_id+'->'+query);
    if(id!==null)
        id=id[0];
    else
        id=query;
    let sharebtn=true
    if(query.indexOf('-share')>-1)
        sharebtn=false;
    let addtags=false;
    if(query.indexOf('+tags')>-1)
        addtags=true;
    query=query.replace('-share','').replace('+tags','');
    let p=offset;
    if(isNaN(offset) || offset==='')
        p=0;
    let p1=offset.split('_');
    if(p1[1]!==undefined)
        p1=p1[1];
    else
        p1=false;
    try {
        if(offset!=='' && !isNaN(query)){
            console.log(offset);
            //如果数据有这个offset就直接调用数据库的 缓存为一天
            connection.query('SELECT * FROM `Pixiv_bot_cache` WHERE `offset`= ? AND `time`> ? ',[offset,unixtime-86400], function (error, results, fields) {
                if(results.length>0)
                    requestapi('answerInlineQuery',{arr:[["inline_query_id",query_id],['next_offset',utils.md5(results[0].next_url)],['cache_time',config.bot.cache_time],["results",JSON.stringify(workillusts(JSON.parse(results[0].results),sharebtn,addtags))]]});
                else
                    //没有的话从数据库查询 next_offset 里面的 next_url
                    connection.query('SELECT * FROM `Pixiv_bot_cache` WHERE `next_offset` = ?',[offset], function (error, results, fields) {
                        if(error)
                            console.error(error);
                        if((results.length>0) && (results[0].next_url!='-')){
                            pixiv.requestUrl(results[0].next_url).then(pixdata => {
                                //然后缓存
                                //然后生成next_offset
                                //如果没了就不提供 next_offset
                                if(pixdata.next_url==null)
                                    pixdata.next_url='-';
                                if(pixdata.illusts.length>0){
                                    let next_offset=utils.md5(pixdata.next_url);
                                    connection.query('INSERT INTO `Pixiv_bot_cache` (`user_id`, `query`, `offset`, `next_offset`,`results`, `time`,`next_url`) VALUES (?, ?, ?, ?, ?, ?,?)',[user_id,query,offset,next_offset,JSON.stringify(pixdata.illusts),unixtime,pixdata.next_url], function (error, results, fields) {
                                        if(error)
                                            console.error(error);
                                        requestapi('answerInlineQuery',{arr:[["inline_query_id",query_id],['cache_time',config.bot.cache_time],['next_offset',next_offset],["results",JSON.stringify(workillusts(pixdata.illusts,sharebtn,addtags))]]});
                                    })
                                }else
                                    requestapi('answerInlineQuery',{arr:[["inline_query_id",query_id],['cache_time',config.bot.cache_time],["results",JSON.stringify(workillusts(results[0].results,sharebtn,addtags))]]});
                            })
                        }else{
                            //没结果？ 不存在的吧
                            requestapi('answerInlineQuery',{arr:[["inline_query_id",query_id],['cache_time',config.bot.cache_time],["results",'[]']]});
                        }
                    })
            })
        }else if(!isNaN(id) && query!=='')
            connection.query('SELECT * FROM `Pixiv_bot_p_list` WHERE `illust_id` = ?',[id], function (error, results, fields) {
                if(results.length>0){
                    let arr=results[0];
                    let arrimg=[];
                    arrimg[0]=JSON.parse(arr.thumb_url);
                    arrimg[1]=JSON.parse(arr.original_url);
                    if(addtags){
                        arr.title+='\n';
                        (JSON.parse(arr.tags)).forEach(function(tag) {
                            arr.title+='#'+tag['name']+' ';
                        }, this);
                    }
                    let isugoira=arr.ugoira;
                    //dalao有更好的思路吗？ 目前想不到了
                    for (var i = p*50; i < (parseInt(p)+1)*49+1; i++) {
                        if(arrimg[1][i]===undefined)
                            break;
                        if(isugoira==1)
                            if(arr.file_id!=='')
                                inline.push({
                                    id:id.toString()+i,
                                    type: 'mpeg4_gif',
                                    mpeg4_file_id:arr.file_id,
                                    caption: arr.title,
                                    reply_markup:genkeyboard(id,sharebtn,i)
                                });
                                else
                                    requestapi('answerInlineQuery',{arr:[["inline_query_id",query_id],['cache_time',0],['switch_pm_text','click me to generate GIF'],['switch_pm_parameter',id]]});
                            else
                                inline.push({
                                    id:id.toString()+i,
                                    type: 'photo',
                                    photo_url: arrimg[1][i].replace('https://i.pximg.net',config.proxyurl),
                                    thumb_url: arrimg[1][i].replace('https://i.pximg.net',config.proxyurl),
                                    caption: arr.title,
                                    photo_width: arr.width,
                                    photo_height: arr.height,
                                    reply_markup:genkeyboard(id,sharebtn,i)
                                });
                    }
                    if(inline.length>=49)
                        requestapi('answerInlineQuery',{arr:[["inline_query_id",query_id],['next_offset',p+1],["results",JSON.stringify(inline)]]});
                    else
                        requestapi('answerInlineQuery',{arr:[["inline_query_id",query_id],["results",JSON.stringify(inline)]]});
                }else
                    pixiv.illustDetail(id).then(pixdata => {
                        pixiv.bookmarkIllust(id);
                        let arrimg=[[],[],[]];
                        if(pixdata.illust.meta_single_page.original_image_url!==undefined){
                            arrimg[0][0]=pixdata.illust.image_urls.square_medium;
                            arrimg[1][0]=pixdata.illust.meta_single_page.original_image_url;
                            arrimg[2][0]=0;
                            if(pixdata.illust.meta_single_page.original_image_url.indexOf('ugoira')>-1)
                                arrimg[2][0]=1;
                        }else
                            (pixdata.illust.meta_pages).forEach(function(img) {
                                arrimg[0].push(img.image_urls.square_medium);
                                arrimg[1].push(img.image_urls.original);
                                if((pixdata.illust.meta_single_page.original_image_url!==undefined) && (pixdata.illust.meta_single_page.original_image_url.indexOf('ugoira')>-1))
                                    arrimg[2].push(1);
                                else 
                                    arrimg[2].push(0);
                            }, this);
                        
                        connection.query('INSERT INTO `Pixiv_bot_p_list` (`user_id`, `illust_id`, `ugoira`, `original_url`,`file_id`, `width`, `height`, `thumb_url`, `author_id`, `author_name`, `author_account`, `tags`, `caption`,`title`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);', [user_id, id, arrimg[2][0], JSON.stringify(arrimg[1]), '', pixdata.illust.width, pixdata.illust.height, JSON.stringify(arrimg[0]), pixdata.illust.user.id,pixdata.illust.user.name , pixdata.illust.user.account, JSON.stringify(pixdata.illust.tags), pixdata.illust.caption,pixdata.illust.title]);
                        if(arrimg[2][0]==1){
                            requestapi('answerInlineQuery',{arr:[["inline_query_id",query_id],['cache_time',0],['switch_pm_text','click me to generate GIF'],['switch_pm_parameter',id]]});
                        }else{
                            if(addtags){
                                pixdata.illust.title+='\n';
                                (JSON.parse(pixdata.illust.tags)).forEach(function(tag) {
                                    pixdata.illust.title+='#'+tag['name']+' ';
                                }, this);
                            }
                            for (var i = p*50; i < (parseInt(p)+1)*49+1; i++) {
                                if(arrimg[1][i]===undefined)
                                    break;
                                inline.push({
                                    id:id.toString()+i,
                                    type: 'photo',
                                    photo_url: arrimg[1][i].replace('https://i.pximg.net',config.proxyurl),
                                    thumb_url: arrimg[1][i].replace('https://i.pximg.net',config.proxyurl),
                                    caption:pixdata.illust.title,
                                    photo_width: pixdata.width,
                                    photo_height: pixdata.height,
                                    reply_markup:genkeyboard(id,sharebtn,i)
                                });
                            }
                            if(inline.length>=49)
                                requestapi('answerInlineQuery',{arr:[["inline_query_id",query_id],['next_offset',parseInt(p)+1],["results",JSON.stringify(inline)]]});
                            else
                                requestapi('answerInlineQuery',{arr:[["inline_query_id",query_id],["results",JSON.stringify(inline)]]});
                        }
                        });
                
                });
                else
                    connection.query('SELECT * FROM `Pixiv_bot_cache` WHERE `query` = ? AND `offset`= ? AND `time` > ?',[id,offset,unixtime-86400], function (error, results, fields) {
                        if(error)
                            console.error(error);
                        if(results.length>0)
                            requestapi('answerInlineQuery',{arr:[["inline_query_id",query_id],['cache_time',config.bot.cache_time],['next_offset',results[0].next_offset],["results",JSON.stringify(workillusts(JSON.parse(results[0].results),sharebtn,addtags))]]});
                        else{
                            if(query==='')
                                pixiv.illustRanking().then(pixdata=>{
                                    if(pixdata.next_url==null)
                                        pixdata.next_url='-';   
                                    let next_offset=utils.md5(pixdata.next_url);   
                                    connection.query('INSERT INTO `Pixiv_bot_cache` (`user_id`, `query`, `offset`, `next_offset`,`results`, `time`,`next_url`) VALUES (?, ?, ?, ?, ?,?,?)',[user_id,query,offset,next_offset,JSON.stringify(pixdata.illusts),unixtime,pixdata.next_url], function (error, results, fields) {
                                        if(error)
                                            console.error(error);
                                    requestapi('answerInlineQuery',{arr:[["inline_query_id",query_id],['cache_time',config.bot.cache_time],['next_offset',next_offset],["results",JSON.stringify(workillusts(pixdata.illusts,sharebtn,addtags))]]});
                                    });
                                });
                            else
                                pixiv.searchIllust(query).then(pixdata => {
                                    if(pixdata.next_url==null)
                                        pixdata.next_url='-';
                                    let next_offset=utils.md5(pixdata.next_url);
                                    connection.query('INSERT INTO `Pixiv_bot_cache` (`user_id`, `query`, `offset`, `next_offset`,`results`, `time`,`next_url`) VALUES (?, ?, ?, ?, ?,?,?)',[user_id,query,offset,next_offset,JSON.stringify(pixdata.illusts),unixtime,pixdata.next_url], function (error, results, fields) {
                                        if(error)
                                            console.error(error);
                                    requestapi('answerInlineQuery',{arr:[["inline_query_id",query_id],['cache_time',config.bot.cache_time],['next_offset',next_offset],["results",JSON.stringify(workillusts(pixdata.illusts,sharebtn,addtags))]]});
                                    });
                                });
                            }           
                        })  
    }catch(e){
        requestapi('SendMessage',{arr:[['chat_id',config.bot.masterid],['text',"发生错误啦~\n"+ encodeURI(e)]]});
    } 
}
function domessage(message) {
    let chat_id=message.chat.id;
    let user_id=message.from.id;
    let message_id=message.message_id;
    let text="";
    if(message.text!==undefined)
         text=message.text;
    let rmusernametext=text.replace("@"+config.bot.username,"")
    let otext=rmusernametext.split(" ");
    let id=text.match(new RegExp(/[0-9]{8}/ig));
    console.log(new Date()+' '+message.from.first_name+' '+message.from.last_name+'->'+user_id+'->'+text);
    if(id!=null)
        id=id[0];
    else
        id=text;
    if(!isNaN(id) && (id!='')){
        //我才不想用async
        connection.query('SELECT * FROM `Pixiv_bot_p_list` WHERE `illust_id` = ?',[id], function (error, results, fields) {
            if(error)
                console.error(error);
            if(results.length>0){
                let arr=results[0];
                let arrimg=[];
                arrimg[0]=JSON.parse(arr.thumb_url);
                arrimg[1]=JSON.parse(arr.original_url);
                let isugoira=arr.ugoira;
                for (var i = 0; i < arrimg[0].length; i++) {
                    if(isugoira==1){
                        if(arr.file_id==''){
                          try{
                            request('https://www.pixiv.net/member_illust.php?mode=medium&illust_id='+id,function (err,res,body){
                                let pxframes;
                                //一瞬注入
                                eval('pxframes'+cheerio.load(body)('#wrapper script').html().replace(/ /g,'').split('pixiv.context.ugokuIllustData')[1].split('pixiv.context.ugokuIllustFullscreenData')[0]);
                                let frame='# timecode format v2\n0\n';
                                let tempframe=0;
                                (pxframes.frames).forEach(function(element) {
                                    tempframe+=element.delay;
                                    frame+=tempframe+"\n";
                                }, this);
                                fs.writeFileSync('./file/timecode/'+id+'.txt',frame);
                                request(pxframes.src.replace('https://i.pximg.net',config.proxyurl),function (err,res,body){
                                    exec('ffmpeg -i ./file/ugoira/'+id+'/%6d.jpg -c:v libx264 -vf "format=yuv420p,scale=trunc(iw/2)*2:trunc(ih/2)*2" ./file/mp4_1/'+id+'.mp4',{timeout:60*1000}, (error, stdout, stderr) => {
                                        if (error)
                                            console.error(error);
                                        else
                                            exec('mp4fpsmod -o ./file/mp4_2/'+id+'.mp4 -t ./file/timecode/'+id+'.txt ./file/mp4_1/'+id+'.mp4',{timeout:60*1000}, (error, stdout, stderr) => {
                                                if(error)
                                                    console.error(error);
                                                else
                                                    api.sendVideo(chat_id,fs.createReadStream('./file/mp4_2/'+id+'.mp4'),{
                                                        reply_markup:JSON.stringify(genkeyboard(id,true,i)),
                                                        caption: arr.title
                                                    }).then(res => {                                    
                                                        connection.query('UPDATE `Pixiv_bot_p_list` SET `file_id` = ? WHERE `illust_id` = ?',[res.body.result.document.file_id,id]);
                                                    });
                                            });
                                        });
                                    }).pipe(unzip.Extract({ path: './file/ugoira/'+id })); 
                                });
                            }catch(error){
                                requestapi('SendMessage',{arr:[['chat_id',config.bot.masterid],['text',"转换发生错误\n"+error]]});
                                requestapi('SendMessage',{arr:[['chat_id',chat_id],['text',"internal error"]]});
                            }
                        }else
                            api.sendVideo(chat_id,fs.createReadStream('./file/mp4_2/'+id+'.mp4'),{
                                caption: arr.title,
                                reply_markup:JSON.stringify(genkeyboard(id,true,i))
                            })
                    }else 
                        api.sendPhoto(chat_id,arrimg[1][i].replace('https://i.pximg.net',config.proxyurl),{
                            reply_markup:JSON.stringify(genkeyboard(id,true,i)),
                            caption: arr.title
                        })
                    }
                }else{
                    pixiv.illustDetail(id).then(pixdata => {
                        pixiv.bookmarkIllust(id);
                        let arrimg=[[],[],[]];
                        if(pixdata.illust.meta_single_page.original_image_url!==undefined){
                            arrimg[0][0]=pixdata.illust.image_urls.square_medium;
                            arrimg[1][0]=pixdata.illust.meta_single_page.original_image_url;
                            arrimg[2][0]=0;
                            if(pixdata.illust.meta_single_page.original_image_url.indexOf('ugoira')>-1)
                                arrimg[2][0]=1;
                            else 
                                arrimg[2].push(0);
                        }else
                            (pixdata.illust.meta_pages).forEach(function(img) {
                                arrimg[0].push(img.image_urls.square_medium);
                                arrimg[1].push(img.image_urls.original);
                                if((pixdata.illust.meta_single_page.original_image_url!==undefined) && (pixdata.illust.meta_single_page.original_image_url.indexOf('ugoira')>-1))
                                    arrimg[2].push(1);
                                arrimg[2].push(0);
                            }, this);
                        connection.query('INSERT INTO `Pixiv_bot_p_list` (`user_id`, `illust_id`, `ugoira`, `original_url`,`file_id`, `width`, `height`, `thumb_url`, `author_id`, `author_name`, `author_account`, `tags`, `caption`,`title`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);', [user_id, id, arrimg[2][0], JSON.stringify(arrimg[1]), '', pixdata.illust.width, pixdata.illust.height, JSON.stringify(arrimg[0]), pixdata.illust.user.id,pixdata.illust.user.name , pixdata.illust.user.account, JSON.stringify(pixdata.illust.tags), pixdata.illust.caption,pixdata.illust.title], function (error, results, fields) {
                            if(error)
                                console.error(error);
                        });
                        for (var i = 0; i < arrimg[0].length; i++) {
                            if(arrimg[2][i]==1){
                                try{
                                    request('https://www.pixiv.net/member_illust.php?mode=medium&illust_id='+id,function (err,res,body){
                                        let pxframes;
                                        //一瞬注入
                                        eval('pxframes'+cheerio.load(body)('#wrapper script').html().replace(/ /g,'').split('pixiv.context.ugokuIllustData')[1].split('pixiv.context.ugokuIllustFullscreenData')[0]);
                                        let frame='# timecode format v2\n0\n';
                                        let tempframe=0;
                                        (pxframes.frames).forEach(function(element) {
                                            tempframe+=element.delay;
                                            frame+=tempframe+"\n";
                                        }, this);
                                        fs.writeFileSync('./file/timecode/'+id+'.txt',frame);
                                        request(pxframes.src.replace('https://i.pximg.net',config.proxyurl),function (err,res,body){
                                            exec('ffmpeg -i ./file/ugoira/'+id+'/%6d.jpg -c:v libx264 -vf "format=yuv420p,scale=trunc(iw/2)*2:trunc(ih/2)*2" ./file/mp4_1/'+id+'.mp4',{timeout:60*1000}, (error, stdout, stderr) => {
                                                if (error)
                                                    console.error(error);
                                                else
                                                    exec('mp4fpsmod -o ./file/mp4_2/'+id+'.mp4 -t ./file/timecode/'+id+'.txt ./file/mp4_1/'+id+'.mp4',{timeout:60*1000}, (error, stdout, stderr) => {
                                                        if(error)
                                                            console.error(error);
                                                        else
                                                            api.sendVideo(chat_id,fs.createReadStream('./file/mp4_2/'+id+'.mp4'),{
                                                                reply_markup:JSON.stringify(genkeyboard(id,true,i)),
                                                                caption: arr.title
                                                            }).then(res => {                                    
                                                                connection.query('UPDATE `Pixiv_bot_p_list` SET `file_id` = ? WHERE `illust_id` = ?',[res.body.result.document.file_id,id]);
                                                            });
                                                    });
                                                });
                                            }).pipe(unzip.Extract({ path: './file/ugoira/'+id })); 
                                        });
                                    }catch(error){
                                        requestapi('SendMessage',{arr:[['chat_id',config.bot.masterid],['text',"转换发生错误\n"+error]]});
                                        requestapi('SendMessage',{arr:[['chat_id',chat_id],['text',"internal error"]]});
                                    }
                            }else{
                                api.sendPhoto(chat_id,arrimg[1][i].replace('https://i.pximg.net',config.proxyurl),{
                                    reply_markup:JSON.stringify(genkeyboard(id,true,i)),
                                    caption: pixdata.illust.title
                                })
                            }
                        }
                    })                            
                }
            });
        }else{
            switch (otext[0]) {
                case '/proxyurledit':
                    if(user_id==config.bot.masterid){
                        api.sendMessage(chat_id,'Proxy url updated');
                        config.proxyurl=otext[1];
                        fs.writeFileSync('config.json',JSON.stringify(config));
                    }
                    break;
                default:
                    if(chat_id>0)
                        api.sendMessage(chat_id,'Please input pixiv illust id\nfor example: https://www.pixiv.net/member_illust.php?mode=medium&illust_id=64551847');
            }
        }
}
function requestapi(type,value) {
    let arr1="?";
    let arr2={};
    if((value!==undefined) && (value.arr!==undefined))
        (value.arr).forEach(function(arr) {
            arr1+=encodeURIComponent(arr[0])+"="+encodeURIComponent(arr[1]);
            if(arr[0]!=value.arr[value.arr.length-1][0])
            arr1+="&";
            //arr2[arr[0]] = arr[1];
        });
    return new promise(function(lll,err) {
        request('https://api.telegram.org/bot'+config.bot.token+'/'+type+arr1,function (error, response, body) {
            try {
                if(error)
                    console.error(error);
                else if(!JSON.parse(body).ok)
                    requestapi('SendMessage',{arr:[['chat_id',config.bot.masterid],['text',"发生错误啦~\n"+body]]});
                lll(JSON.parse(body));   
            } catch (e) {
                console.error('tg api boom!')
            }
        });   
  });
};