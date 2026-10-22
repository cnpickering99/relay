INSERT INTO public.users (username, email, verificationcode, vcexpierytime, authenticationtoken, atexpirerytime, createdat, lastlogintime)
VALUES
('jdoe23', 'jdoe23@example.com', 'VC-8X2K9LQ', '2026-06-28 10:00:00', 'AT-3F9D7H2K1MZQ8X', '2026-06-27 22:00:00', '2026-01-15 09:23:00', '2026-06-26 18:42:11'),
('amartin', 'amartin@example.com', 'VC-7H3J1NPQ', '2026-06-29 11:30:00', 'AT-9K2L5T8R3V0YZX1', '2026-06-27 23:15:00', '2026-02-03 14:10:05', '2026-06-25 09:05:37'),
('chen_wei', 'chen.wei@example.com', NULL, NULL, 'AT-4M8N2P6Q9STUV3W', '2026-06-28 02:45:00', '2026-01-28 08:00:00', '2026-06-27 07:11:02'),
('sjohnson', 'sjohnson@example.com', 'VC-2Q6W4ERT5', '2026-06-27 16:20:00', NULL, NULL, '2026-03-10 12:00:00', NULL),
('mpatel', 'mpatel@example.com', 'VC-9Y3U7IOP1', '2026-06-30 09:00:00', 'AT-1A5S8D2F4G7H0J3', '2026-06-28 01:30:00', '2026-01-05 17:45:00', '2026-06-24 21:30:00'),
('lgarcia', 'lgarcia@example.com', NULL, NULL, NULL, NULL, '2026-04-12 10:00:00', NULL),
('kwilliams', 'kwilliams@example.com', 'VC-5R8T2YUI3', '2026-06-29 14:00:00', 'AT-6Z9X3C7V1B4N8M2K', '2026-06-28 03:00:00', '2026-02-20 11:15:00', '2026-06-26 13:55:48'),
('nbrown', 'nbrown@example.com', 'VC-3E7R1TYU9', '2026-06-28 19:45:00', 'AT-0P4Q8W2E6R1T9Y3U', '2026-06-27 20:10:00', '2026-03-01 08:30:00', '2026-06-23 16:08:22'),
('rsingh', 'rsingh@example.com', NULL, NULL, 'AT-7L3K9J5H2G8F4D1S', '2026-06-29 00:00:00', '2026-01-18 13:20:00', '2026-06-27 11:47:09'),
('tlee', 'tlee@example.com', 'VC-1A4S7D2F8G', '2026-06-30 17:30:00', NULL, NULL, '2026-05-02 15:00:00', NULL);

-- Scores are seeded only for users who have logged in (lastlogintime IS NOT NULL);
-- sjohnson, lgarcia and tlee have never logged in, so they have no scores.
-- username/email are pulled from public.users via the email join so they always match.
-- Every created_at falls after the user's createdat and before their lastlogintime.
INSERT INTO public.scores (email, username, score, words_used, created_at)
SELECT u.email, u.username, s.score, s.words_used, s.created_at
FROM (VALUES
	-- jdoe23 (created 2026-01-15, last login 2026-06-26)
	('avimal5000@gmail.com',    1250, 14, TIMESTAMP '2026-02-01 19:12:00'),
	('avimal5000@gmail.com',    2210, 22, TIMESTAMP '2026-05-09 21:03:12'),
	('avimal5000@gmail.com',    2975, 27, TIMESTAMP '2026-06-20 18:30:44'),
	-- amartin (created 2026-02-03, last login 2026-06-25)
	('amartin@example.com',    980, 11, TIMESTAMP '2026-02-10 08:22:10'),
	('amartin@example.com',   1530, 16, TIMESTAMP '2026-04-02 12:47:55'),
	('amartin@example.com',   1695, 18, TIMESTAMP '2026-06-18 09:15:03'),
	-- chen_wei (created 2026-01-28, last login 2026-06-27)
	('chen.wei@example.com',  3420, 31, TIMESTAMP '2026-02-15 22:10:27'),
	('chen.wei@example.com',  3890, 34, TIMESTAMP '2026-04-21 23:01:09'),
	('chen.wei@example.com',  4310, 38, TIMESTAMP '2026-06-25 21:44:50'),
	-- mpatel (created 2026-01-05, last login 2026-06-24)
	('mpatel@example.com',     640,  8, TIMESTAMP '2026-01-20 17:55:41'),
	('mpatel@example.com',     910, 10, TIMESTAMP '2026-03-30 18:20:16'),
	-- kwilliams (created 2026-02-20, last login 2026-06-26)
	('kwilliams@example.com', 2105, 21, TIMESTAMP '2026-03-05 13:37:22'),
	('kwilliams@example.com', 2560, 24, TIMESTAMP '2026-05-17 14:08:33'),
	('kwilliams@example.com', 2790, 26, TIMESTAMP '2026-06-22 15:51:07'),
	-- nbrown (created 2026-03-01, last login 2026-06-23)
	('nbrown@example.com',     455,  6, TIMESTAMP '2026-03-12 10:14:58'),
	('nbrown@example.com',    1120, 13, TIMESTAMP '2026-05-28 11:29:40'),
	-- rsingh (created 2026-01-18, last login 2026-06-27)
	('rsingh@example.com',    1745, 17, TIMESTAMP '2026-02-08 16:40:19'),
	('rsingh@example.com',    2380, 23, TIMESTAMP '2026-04-16 17:05:02'),
	('rsingh@example.com',    3055, 29, TIMESTAMP '2026-06-26 10:58:36')
) AS s(email, score, words_used, created_at)
JOIN public.users u ON u.email = s.email;