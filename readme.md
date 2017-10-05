# pixiv bot
## Demo
### [Pixiv_bot](https://t.me/pixiv_bot)  
## description
  1.quick send day rank
  
  ![quick_send_day_rank.png](https://i.loli.net/2017/10/04/59d49c6406607.png)

  2.quick search

  ![quick_search.png](https://i.loli.net/2017/10/04/59d49c6431731.png)
 
  3.ugoira img support(ugoira to mp4)

  ![ugoira_support.png](https://i.loli.net/2017/10/04/59d49c60104d3.png)

  4.multi illust_p support

  ![multi_illust_p_support.png](https://i.loli.net/2017/10/04/59d49c6090dbb.png)

  5.send by illust id

  ![quick_send_by_illust_id.png](https://i.loli.net/2017/10/04/59d49c60a5706.png)

## Install
    pacman -S ffmpeg git make automake autoconf gcc nodejs npm supervisor nginx
    git clone https://github.com/nu774/mp4fpsmod.git
    git clone https://github.com/xiao201261/pixiv_bot.git
    #AUR
    cd mp4fpsmod
    ./bootstrap.sh
    ./configure
    make
    make install
    cd ../pixiv_bot
    mkdir file file/mp4_1 file/mp4_2 file/timecode file/ugoira
    npm install
    npm install -g supervisor
    rm -fr ../mp4fpsmod
    cp -r config_sample.json config.json
    #edit config
    nano config.json
    #import bot.sql to mysql
### Edit nginx config(proxy)
    server{
        server_name _your_domain_here;
        listen 80;
        location / {
            proxy_pass https://i.pximg.net;
            proxy_set_header referer https://www.pixiv.net;
        }
    }
### Run
    screen -S pixiv_bot supervisor -i file node app.js
## Thanks
    ffmpeg
    https://stackoverflow.com/questions/28086775/can-i-create-a-vfr-video-from-timestamped-images
    mp4fpsmod
## License

GPLv3

## Made with ♥