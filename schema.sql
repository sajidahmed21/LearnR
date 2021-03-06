/* SQLite doesn't have foreign keys enabled by default. So we have to turn it on. */
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS USERS (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  profile_color TEXT,
  banner_path TEXT
);

CREATE TABLE IF NOT EXISTS GOOGLE_CREDENTIALS (
  id VARCHAR(64) PRIMARY KEY,
  user_id INTEGER NOT NULL,
  
  FOREIGN KEY(user_id) REFERENCES USERS(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS LOGIN_CREDENTIALS (
  user_id INTEGER PRIMARY KEY,
  username varchar(32) UNIQUE NOT NULL,
  password varchar(128) NOT NULL,

  FOREIGN KEY(user_id) REFERENCES USERS(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS FOLLOWINGS (
  follower INTEGER NOT NULL,
  followee INTEGER NOT NULL,

  PRIMARY KEY(follower, followee),
  FOREIGN KEY(follower) REFERENCES USERS(id) ON DELETE CASCADE,
  FOREIGN KEY(followee) REFERENCES USERS(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS NOTIFICATIONS (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  followee_id INTEGER NOT NULL,
  class_id INTEGER NOT NULL,
  created_timestamp INTEGER DEFAULT (datetime('now')),

  FOREIGN KEY(user_id) REFERENCES USERS(id) ON DELETE CASCADE,
  FOREIGN KEY(followee_id) REFERENCES USERS(id) ON DELETE CASCADE,
  FOREIGN KEY(class_id) REFERENCES CLASSES(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ADMIN_CREDENTIALS (
  username varchar(32) PRIMARY KEY,
  password varchar(128) NOT NULL
);

CREATE TABLE IF NOT EXISTS CLASSES (
  id INTEGER PRIMARY KEY,
  class_name varchar(64) NOT NULL,
  instructor INTEGER NOT NULL,
  coursedesc TEXT,
  coursereqs TEXT,
  banner_picture_path TEXT,
  created_timestamp INTEGER DEFAULT (datetime('now')),

  UNIQUE(instructor, class_name),
  FOREIGN KEY(instructor) REFERENCES USERS(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS INSTRUCTOR_POSTS (
  id INTEGER PRIMARY KEY,
  class_id INTEGER NOT NULL,
  created_timestamp INTEGER DEFAULT (datetime('now')),
  content TEXT NOT NULL,

  FOREIGN KEY(class_id) REFERENCES CLASSES(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS REVIEWS (
  user_id INTEGER NOT NULL,
  class_id INTEGER NOT NULL,
  created_timestamp INTEGER DEFAULT (datetime('now')),
  content TEXT,
  rating INTEGER,

  PRIMARY KEY(user_id, class_id),
  FOREIGN KEY(user_id) REFERENCES USERS(id) ON DELETE CASCADE,
  FOREIGN KEY(class_id) REFERENCES CLASSES(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ENROLMENT (
  user_id INTEGER NOT NULL,
  class_id INTEGER NOT NULL,

  PRIMARY KEY(user_id, class_id),
  FOREIGN KEY(user_id) REFERENCES USERS(id) ON DELETE CASCADE,
  FOREIGN KEY(class_id) REFERENCES CLASSES(id) ON DELETE CASCADE
);

/* TODO: Decide if we want to keep this */
CREATE TABLE IF NOT EXISTS MESSAGES (
  id INTEGER PRIMARY KEY,
  sender INTEGER NOT NULL,
  receiver INTEGER NOT NULL,
  send_timestamp INTEGER DEFAULT (datetime('now')),
  content TEXT NOT NULL,
  seen_timestamp INTEGER
);

CREATE TABLE IF NOT EXISTS LOGIN_HISTORY (
  user_id INTEGER NOT NULL,
  login_timestamp INTEGER DEFAULT (datetime('now')),

  PRIMARY KEY(user_id, login_timestamp),
  FOREIGN KEY(user_id) REFERENCES USERS(id) ON DELETE CASCADE
);
