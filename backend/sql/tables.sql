-- public.users definition

-- Drop table

-- DROP TABLE public.users;

CREATE TABLE public.users (
	username varchar(100) NULL,
	email varchar(200) NOT NULL,
	verificationcode varchar(500) NULL,
	vcexpierytime timestamp NULL,
	authenticationtoken varchar(500) NULL,
	atexpirerytime timestamp NULL,
	createdat timestamp DEFAULT now() NOT NULL,
	lastlogintime timestamp NULL
);