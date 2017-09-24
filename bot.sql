-- Adminer 4.3.1 MySQL dump

SET NAMES utf8;
SET time_zone = '+00:00';
SET foreign_key_checks = 0;
SET sql_mode = 'NO_AUTO_VALUE_ON_ZERO';

SET NAMES utf8mb4;

DROP TABLE IF EXISTS `Pixiv_bot_cache`;
CREATE TABLE `Pixiv_bot_cache` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) NOT NULL,
  `query` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `offset` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `next_offset` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `text` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `results` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `next_url` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `time` bigint(20) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


DROP TABLE IF EXISTS `Pixiv_bot_p_list`;
CREATE TABLE `Pixiv_bot_p_list` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) NOT NULL,
  `illust_id` bigint(20) NOT NULL,
  `ugoira` int(11) NOT NULL,
  `original_url` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_id` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `width` int(11) NOT NULL,
  `height` int(11) NOT NULL,
  `thumb_url` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `author_id` bigint(20) NOT NULL,
  `author_name` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `author_account` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `tags` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `caption` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` text COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `illust_id` (`illust_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 2017-09-24 06:16:26
