import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();

app.use(cors());

app.use(express.json({ limit: '10mb' }));

app.use(express.urlencoded({ limit: '10mb', extended: true }));

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/seu-banco';
const JWT_SECRET = process.env.JWT_SECRET || 'seu-segredo-jwt-super-secreto';

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ Conectado ao MongoDB');
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('❌ Erro ao conectar ao MongoDB:', error.message);
    process.exit(1);
  });

interface IUser extends mongoose.Document {
  email: string;
  password: string;
  username: string;
  profileImage?: string;
}

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true },
  username: { type: String, required: true, unique: true, trim: true },
  profileImage: { type: String, default: null },
 });

const User = mongoose.model<IUser>('User', UserSchema);


app.get('/', (req: Request, res: Response) => {
  res.send('Backend OK!');
});


app.post('/api/register', asyncHandler(async (req: Request, res: Response) => {
  const { email, password, username } = req.body;


  if (!email || !password || !username) {
    return res.status(400).json({ message: 'Email, senha e nome de usuário são obrigatórios.' });
  }


  if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return res.status(400).json({ message: 'A senha deve ter pelo menos 8 caracteres, incluindo uma letra maiúscula e um número.' });
  }


  const existingUser = await User.findOne({ $or: [{ email }, { username }] });
  if (existingUser) {
    const field = existingUser.email === email ? 'Email' : 'Nome de usuário';
    return res.status(409).json({ message: `${field} já cadastrado.` });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = new User({ email, password: hashedPassword, username });
  await newUser.save();


  res.status(201).json({ message: 'Usuário cadastrado com sucesso!' });
}));


app.post('/api/login', asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email e senha são obrigatórios.' });
  }

  const user = await User.findOne({ email });
  if (!user) {

    return res.status(401).json({ message: 'Credenciais inválidas.' });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return res.status(401).json({ message: 'Credenciais inválidas.' });
  }


  const payload = {
    id: user._id,

  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

  res.status(200).json({
    message: 'Login realizado com sucesso!',
    token,
    username: user.username,
    userId: user._id,
    redirectTo: '/DashboardHome',
  });
}));

app.post('/api/refresh-token', asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ message: 'Token é obrigatório.' });
  }

  try {

    const decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true }) as jwt.JwtPayload;

    const userExists = await User.findById(decoded.id);
    if (!userExists) {
      return res.status(401).json({ message: 'Usuário não encontrado.' });
    }
    const newPayload = { id: decoded.id };
    const newToken = jwt.sign(newPayload, JWT_SECRET, { expiresIn: '1h' });

    res.status(200).json({ token: newToken });
  } catch (error) {

    res.status(401).json({ message: 'Token inválido.' });
  }
}));

app.post('/api/update-profile-image', asyncHandler(async (req: Request, res: Response) => {
  const { userId, profileImage, username } = req.body;

  if (!userId || !profileImage) {

    return res.status(400).json({ message: 'ID do usuário e imagem são obrigatórios.' });

  }

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: 'ID de usuário inválido.' });
  }

  try {

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profileImage },
      { new: true, runValidators: true }
    ).select('-password');
    if (!updatedUser) {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }
    res.status(200).json({
      message: 'Imagem atualizada com sucesso!',
      user: {
        _id: updatedUser._id,
        username: updatedUser.username,
        email: updatedUser.email,
        profileImage: updatedUser.profileImage
      }
    });

  } catch (error) {
    console.error("Erro ao atualizar imagem:", error);
    res.status(500).json({ message: 'Erro interno ao atualizar a imagem.' });
  }
}));

app.get('/api/user/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: 'ID de usuário inválido.' });
  }

  const user = await User.findById(userId).select('-password');

  if (!user) {
    return res.status(404).json({ message: 'Usuário não encontrado.' });
  }

  res.status(200).json(user);
}));

app.get('/api/user/by-username/:username', asyncHandler(async (req: Request, res: Response) => {
  const { username } = req.params;

  const user = await User.findOne({ username }).select('-password');

  if (!user) {
    return res.status(404).json({ message: 'Usuário não encontrado.' });
  }

  res.status(200).json(user);
}));


app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("❌ Erro não tratado:", err);

  res.status(500).json({ message: 'Ocorreu um erro interno no servidor.' });
});

app.use((req: Request, res: Response) => {
  res.status(404).json({ message: 'Rota não encontrada.' });
});
