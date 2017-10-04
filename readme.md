# pixiv bot
## Demo
### [Pixiv_bot](https://t.me/pixiv_bot)  
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
    npm install
    rm -fr ../mp4fpsmod
    cp -r config_sample.json config.json
    #edit config
    nano config.json
    #import bot.sql to mysql
###Edit nginx config(proxy)

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