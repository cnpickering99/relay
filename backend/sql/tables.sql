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

-- public.scores definition

-- Drop table

-- DROP TABLE public.scores;

CREATE TABLE IF NOT EXISTS public.scores (
	id serial PRIMARY KEY,
	email varchar(200) NOT NULL,
	username varchar(100) NOT NULL,
	score int4 NOT NULL CHECK (score >= 0),
	words_used int4 NOT NULL CHECK (words_used >= 0),
	created_at timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS scores_score_idx ON public.scores (score DESC);
CREATE INDEX IF NOT EXISTS scores_email_idx ON public.scores (email);
