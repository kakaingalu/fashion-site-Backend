// server.mjs
import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import errorHandler from './errorHandler.js';
// import fs from 'fs';
import multer from 'multer';
import path, {dirname} from 'path';
import { fileURLToPath } from 'url';
import moment from 'moment';
import fs from 'fs-extra';



const app = express();
const port = 3001;



app.use(express.static('public'));

// Increase the request size limit
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.raw());

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


const uploadDir = path.join(__dirname, 'uploads');

// Function to create the upload directory if it doesn't exist
async function ensureUploadDirectory() {
  try {
    await new Promise((resolve, reject) => {
      fs.access(uploadDir, fs.constants.F_OK, (err) => {
        if (err) {
          fs.mkdir(uploadDir, (err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        } else {
          resolve();
        }
      });
    });
  } catch (error) {
    console.error('Error creating upload directory:', error);
    throw error;
  }
}

await ensureUploadDirectory();

// For file uploads using multer


// Function to create timestamp without seconds
function getTimestampWithoutSeconds() {
  const now = new Date();
  return moment(now).format('YYYY-MM-DD HH:mm');
}

const upload = multer({
  storage: multer.diskStorage({
    destination: function(req, file, cb) {
      const uploadDir =  path.join(__dirname, 'public', 'uploads');
      fs.mkdir(uploadDir, { recursive: true }, (err) => {
        if (err) {
          console.error('Error creating upload directory:', err);
        }
      });
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      cb(null, `${getTimestampWithoutSeconds()}-${file.originalname}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
});

app.use(cors());
app.use(errorHandler);


app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'https://fashion-site-04h0.onrender.com/'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));


// Server-side configuration (Node.js example using Express)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});


// MySQL connection configuration
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '4307',
  database: 'fashion_db'
};

// Connect to MySQL
let pool;
async function connectToMySQL() {
  pool = await mysql.createPool(dbConfig);

  // Create the database if it doesn't exist
  const createDbQuery = `
    CREATE DATABASE IF NOT EXISTS fashion_db;
  `;
  
  try {
    await pool.query(createDbQuery);
    console.log('Database "fashion_db" created successfully');
  } catch (error) {
    console.error('Error creating database:', error);
  }
}

// Create tables
async function createTables() {
  try {
      await pool.query(`
          CREATE TABLE IF NOT EXISTS posts (
              id INT AUTO_INCREMENT PRIMARY KEY,
              title VARCHAR(255),
              content TEXT,
              image_location VARCHAR(255),
              views INT DEFAULT 0,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              image_id VARCHAR(50) UNIQUE
          );
      `);

      await pool.query(`
          CREATE TABLE IF NOT EXISTS comments (
              id INT AUTO_INCREMENT PRIMARY KEY,
              post_id INT,
              author VARCHAR(100),
              content TEXT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (post_id) REFERENCES posts(id)
          );
      `);

      await pool.query(`
          CREATE TABLE IF NOT EXISTS social_media_links (
              id INT AUTO_INCREMENT PRIMARY KEY,
              url VARCHAR(255),
              name VARCHAR(100),
              icon VARCHAR(255)
          );
      `);

      await pool.query(`
          CREATE TABLE IF NOT EXISTS site_icons (
              id INT AUTO_INCREMENT PRIMARY KEY,
              name VARCHAR(100),
              icon VARCHAR(255)
          );
      `);

      console.log("Tables created successfully");
  } catch (error) {
      console.error("Error creating tables:", error);
  }
}


// social media links
const socialMediaLinks = [
  { id: 1, url: "https://www.facebook.com", name: "Facebook", icon: "http://localhost:3001/assets/facebook-app-symbol.png" },
  { id: 2, url: "https://www.twitter.com", name: "Twitter", icon: "http://localhost:3001/assets/twitter.png" },
  { id: 3, url: "https://www.instagram.com", name: "Instagram", icon: "http://localhost:3001/assets/instagram.png" },
  { id: 4, url: "https://www.linkedin.com", name: "Linkedin", icon: "http://localhost:3001/assets/linkedin.png" },
  { id: 5, url: "https://www.pinterest.com", name: "Pinterest", icon: "http://localhost:3001/assets/pinterest-logo.png" },
  { id: 6, url: "https://www.youtube.com", name: "Youtube", icon: "http://localhost:3001/assets/youtube.png" },
] 

// site icons 
const siteIcons = [
  { id: 1, name: "Site Icon", icon: "http://localhost:3001/assets/woman.png" },
  { id: 2, name: "List", icon: "http://localhost:3001/assets/list.png" },
  { id: 3, name: "Close", icon: "http://localhost:3001/assets/close.png" }

]

async function createPost(postData) {
  if (!postData || typeof postData !== 'object') {
    throw new Error('Invalid post data');
  }
  
  const columns = Object.keys(postData);
  const placeholders = columns.map(() => '?').join(', ');
  
  const query = `INSERT INTO posts (${columns.join(', ')}) VALUES (${placeholders})`;
  const params = columns.map(column => postData[column]);
  
  const [result] = await pool.query(query, params);
  return { id: result.insertId, ...postData };
}

async function getPosts() {
  const [rows] = await pool.query('SELECT * FROM posts');
  return rows;
}

async function getPostById(postId) {
  if (!postId || isNaN(postId)) {
    throw new Error('Invalid post ID');
  }

  try {
    const [row] = await pool.query('SELECT * FROM posts WHERE id = ?', [postId]);
    if (!row) {
      throw new Error('Post not found');
    }
    return row;
  } catch (error) {
    console.error('Error fetching post:', error);
    throw error;
  }
}


async function updatePost(postData) {
  await pool.query('UPDATE posts SET ? WHERE id = ?', [postData, postData.id]);
  return getPostById(postData.id);
}

async function deletePost(postId) {
  if (!postId || isNaN(postId) ) {
    throw new Error('Invalid post ID');
  }

  try {
  await pool.query('DELETE FROM posts WHERE id = ?', [postId]);
  const deletedPost = await getPostById(postId);
  return { message: 'Post deleted successfully' };
  } catch (error) {
    console.error('Error deleting post:', error);
    console.log("id:", postId);
    throw new Error('Failed to delete post');
  }
}

// delete image
async function deleteFile(filename) {
  const filePath = path.join(__dirname, 'public', 'uploads', filename);
  
  try {
    await fs.remove(filePath);
    console.log(`File ${filename} deleted successfully`);
    return { success: true, message: 'File deleted successfully' };
  } catch (error) {
    console.error(`Error deleting file ${filename}:`, error);
    return { success: false, message: 'Failed to delete file' };
  }
}

// Initialize the app
async function init() {
  await connectToMySQL();
  await createTables();
}

init().catch(console.error);

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      statusCode: 400,
      message: 'Invalid multipart form data'
    });
  }
  next(err);
});

app.post('/api/posts', async (req, res) => {
  try {
    const newPost = await createPost(req.body);
    res.status(201).json(newPost);
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(400).json({ message: 'Invalid request body' });
  }
});

app.post('/api/upload-image', upload.single('image'), async (req, res) => {
  try {
    const imagePath = `/public/uploads/${req.file.filename}`;

    res.json({location: imagePath});
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});


app.get('/api/posts', async (req, res) => {
  try {
    const posts = await getPosts();
    
    if (!posts || posts.length === 0) {
      res.status(200).json([]);
    } else {
      res.json(posts);
    }
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ message: 'Internal Server Error', details: error.message });
  }
});


app.get('/api/posts/:id', async (req, res) => {
  try {
    const post = await getPostById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    res.json(post);
  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).json({ message: 'Failed to fetch post' });
  }
});

// send social media links
app.get('/api/social-media-links', (req, res) => {
  res.json(socialMediaLinks);
});

// send site icons
app.get('/api/site-icons', (req, res) => {
  res.json(siteIcons);
});

// get uploaded images
app.get('/api/uploads/:filename', (req, res) => {
  const { filename } = req.params
  const filePath = path.join(__dirname, 'uploads', filename
  );
  res.sendFile(filePath);
}
);

// get all images
app.get('/api/uploads', (req, res) => {
  const files = fs.readdirSync(uploadDir  
  );
  res.json(files);
}
);



app.put('/api/posts/:id', async (req, res) => {
  try {
    const updatedPost = await updatePost(req.body);
    res.json(updatedPost);
  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).json({ message: 'Failed to update post' });
  }
});

app.delete('/api/posts/:id', async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    if (isNaN(postId)) {
      return res.status(400).json({ message: 'Invalid post ID' });
    }
    const deletedPost = await deletePost(req.params.id);
    res.json(deletedPost);
  } catch (error) {
    console.error('Error deleting post:', error);
    console.log("id:", req.params.id);
    res.status(500).json({ message: 'Failed to delete post' });
  }
});

// delete image
app.delete('/api/delete-image/:filename', async (req, res) => {
    try {
    const result = await deleteFile(req.params.filename);
    res.json(result);
    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ message: 'Failed to delete image' });
  }
});


// app.listen(port, () => {
//   console.log(`Server listening at http://localhost:${port}`);
// });

app.use(express.static(path.join(__dirname, 'build')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build/index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export { app }; 
