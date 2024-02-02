const Joi = require("joi");
const User = require("../models/user");
const bcrypt = require("bcryptjs");
const userDTO = require("../dto/user");
const JWTService = require("../service/JWTService");
const RefreshToken = require("../models/token");

const passwordPattern =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@.#$!%*?&^])[A-Za-z\d@.#$!%*?&]{8,15}$/;

const authController = {
  async register(req, res, next) {
    // 1. validate user input
    const userRegisterSchema = Joi.object({
      username: Joi.string().min(3).max(50).required(),
      name: Joi.string().max(30).required(),
      email: Joi.string().email().required(),
      password: Joi.string().pattern(passwordPattern).required(),
      confirmPassword: Joi.ref("password"),
    });
    const { error } = userRegisterSchema.validate(req.body);

    // 2. if error  in validation -> return error via middleware

    if (error) {
      return next(error);
    }
    // 3. if email or username is already register -> return en error

    const { username, name, email, password } = req.body;

    try {
      const emailInUse = await User.exists({ email });
      const usernameInUse = await User.exists({ username });

      if (emailInUse) {
        const error = {
          status: 409,
          message: "Email already Register, use another email!",
        };

        return next(error);
      }

      if (usernameInUse) {
        const error = {
          status: 409,
          message: "Username is not available , choose another username",
        };

        return next(error);
      }
    } catch (error) {
      return next(error);
    }

    // 4. password hash

    const hashPassword = await bcrypt.hash(password, 10);

    // 5. store user data in db
    let accessToken;
    let refreshToken;
    let user;
    try {
      const userToRegister = new User({
        username,
        email,
        name,
        password: hashPassword,
      });
      user = await userToRegister.save();

      // token generation
      accessToken = JWTService.signAccessToken(
        {
          _id: user._id,
        },
        "30m"
      );

      refreshToken = JWTService.signRefreshToken({ _id: user._id }, "60m");
    } catch (error) {
      return next(error);
    }

    // store refresh token in db

    await JWTService.storeRefreshToken(refreshToken, user._id);

    // send token in cookies
    res.cookie("accessToken", accessToken, {
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true,
    });

    res.cookie("refreshToken", refreshToken, {
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true,
    });

    // 6. response send

    const userDto = new userDTO(user);

    return res.status(201).json({ user: userDto, auth: true });
  },

  async login(req, res, next) {
    // 1. validate user input

    const userLoginSchema = Joi.object({
      username: Joi.string().min(3).max(30).required(),
      password: Joi.string().pattern(passwordPattern),
    });

    // 2. validation error, return error

    const { error } = userLoginSchema.validate(req.body);

    if (error) {
      return next(error);
    }

    const { username, password } = req.body;
    // 3. match username and password
    let user;
    try {
      // match username
      user = await User.findOne({ username });

      if (!user) {
        const error = {
          status: 401,
          mesasge: "Invalid username",
        };

        return next(error);
      }

      // match password

      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        const error = {
          status: 401,
          message: "Invalid password",
        };

        return next(error);
      }
    } catch (error) {
      return next(error);
    }

    const accessToken = JWTService.signAccessToken({ _id: user._id }, "30m");
    const refreshToken = JWTService.signRefreshToken({ _id: user._id }, "60m");

    // update refresh token in db

    try {
      await RefreshToken.updateOne(
        {
          _id: user._id,
        },
        {
          token: refreshToken,
        },
        {
          upsert: true,
        }
      );
    } catch (error) {
      return next(error);
    }

    // send token in cookies
    res.cookie("accessToken", accessToken, {
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true,
    });

    res.cookie("refreshToken", refreshToken, {
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true,
    });

    const userDto = new userDTO(user);

    // 4. return response

    return res.status(200).json({ user: userDto, auth: true });
  },

  async logout(req, res, next) {
    // 1. delete refresh token from db
    const { refreshToken } = req.cookies;

    try {
      await RefreshToken.deleteOne({ token: refreshToken });
    } catch (error) {
      return next(error);
    }

    // 2. delete cookie
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");

    // 3. response

    res.status(200).json({ user: null, auth: false });
  },

  async refresh(req, res, next) {
    // 1. get refreshToken from cookie
    // 2. verify refreshToken
    // 3. generate new token
    // 4 update db return response

    const orignalRefreshToken = req.cookies.refreshToken;
    let id;
    try {
      id = JWTService.verifyRefreshToken(orignalRefreshToken)._id;
    } catch (e) {
      const error = {
        status: 401,
        message: "unauthorized",
      };

      return next(error);
    }

    try {
      const match = RefreshToken.findOne({
        _id: id,
        token: orignalRefreshToken,
      });
      if (!match) {
        const error = {
          status: 401,
          message: "unauthorized",
        };
        return next(error);
      }
    } catch (e) {
      return next(e);
    }

    try {
      const accessToken = JWTService.signAccessToken({ _id: id }, "30m");
      const refreshToken = JWTService.signRefreshToken({ _id: id }, "60m");

      await RefreshToken.updateOne({ _id: id }, { token: refreshToken });

      res.cookie("accessToken", accessToken, {
        maxAge: 1000 * 60 * 60 * 24,
        httpOnly: true,
      });

      res.cookie("refreshToken", refreshToken, {
        maxAge: 1000 * 60 * 6024,
        httpOnly: true,
      });
    } catch (e) {
      return next(e);
    }

    const user = await User.findOne({ _id: id });

    const userDto = new userDTO(user);

    return res.status(200).json({ user: userDto, auth: true });
  },
};

module.exports = authController;
