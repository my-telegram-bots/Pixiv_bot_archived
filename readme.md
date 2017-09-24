# @pixiv_bot
## install
    pacman -S ffmpeg git make automake autoconf gcc nodejs npm
    git clone https://github.com/nu774/mp4fpsmod.git
    git clone https://github.com/xiao201261/pixiv_bot.git
    cd mp4fpsmod
    ./bootstrap.sh
    ./configure
    make
    make install
    cd ../pixiv_bot
    npm install
    rm -fr ../mp4fpsmod
    cp -r config_sample.json config.json
    nano config.json
    node app.js

