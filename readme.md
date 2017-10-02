# @pixiv_bot
## install(on archlinux)
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
## install(on centos)
    yum -y groupinstall "Development Tools"
    yum install epel-release -y
    yum update -y
    rpm --import http://li.nux.ro/download/nux/RPM-GPG-KEY-nux.ro
    #centos7
    sudo rpm -Uvh http://li.nux.ro/download/nux/dextop/el7/x86_64/nux-dextop-release-0-5.el7.nux.noarch.rpm
    #centos6
    rpm -Uvh http://li.nux.ro/download/nux/dextop/el6/x86_64/nux-dextop-release-0-2.el6.nux.noarch.rpm
    yum install ffmpeg ffmpeg-devel -y
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
