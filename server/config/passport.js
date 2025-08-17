// Passport OAuth Configuration for Social Media Authentication
const passport = require('passport');
const TwitterStrategy = require('passport-twitter').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const { getUserById, createOrUpdateUser } = require('../services/userService');

function configurePassport() {
  // JWT Strategy for API authentication
  passport.use(new JwtStrategy({
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET
  }, async (payload, done) => {
    try {
      const user = await getUserById(payload.sub);
      if (user) {
        return done(null, user);
      } else {
        return done(null, false);
      }
    } catch (error) {
      return done(error, false);
    }
  }));

  // Twitter OAuth Strategy
  passport.use(new TwitterStrategy({
    consumerKey: process.env.TWITTER_CONSUMER_KEY,
    consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
    callbackURL: process.env.TWITTER_CALLBACK_URL || "/api/auth/twitter/callback",
    includeEmail: true
  }, async (token, tokenSecret, profile, done) => {
    try {
      const userData = {
        platform: 'twitter',
        platformId: profile.id,
        username: profile.username,
        displayName: profile.displayName,
        email: profile.emails?.[0]?.value,
        profileImage: profile.photos?.[0]?.value,
        accessToken: token,
        tokenSecret: tokenSecret,
        rawProfile: profile._json
      };
      
      const user = await createOrUpdateUser(userData);
      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }));

  // Facebook OAuth Strategy
  passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_CLIENT_ID,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    callbackURL: process.env.FACEBOOK_CALLBACK_URL || "/api/auth/facebook/callback",
    profileFields: ['id', 'displayName', 'photos', 'email']
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const userData = {
        platform: 'facebook',
        platformId: profile.id,
        displayName: profile.displayName,
        email: profile.emails?.[0]?.value,
        profileImage: profile.photos?.[0]?.value,
        accessToken: accessToken,
        refreshToken: refreshToken,
        rawProfile: profile._json
      };
      
      const user = await createOrUpdateUser(userData);
      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }));

  // Google OAuth Strategy (for YouTube)
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || "/api/auth/google/callback",
    scope: ['profile', 'email', 'https://www.googleapis.com/auth/youtube.readonly']
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const userData = {
        platform: 'google',
        platformId: profile.id,
        username: profile.emails?.[0]?.value?.split('@')[0],
        displayName: profile.displayName,
        email: profile.emails?.[0]?.value,
        profileImage: profile.photos?.[0]?.value,
        accessToken: accessToken,
        refreshToken: refreshToken,
        rawProfile: profile._json
      };
      
      const user = await createOrUpdateUser(userData);
      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }));

  // Instagram Strategy (using Facebook Graph API)
  passport.use('instagram', new FacebookStrategy({
    clientID: process.env.FACEBOOK_CLIENT_ID,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    callbackURL: process.env.INSTAGRAM_CALLBACK_URL || "/api/auth/instagram/callback",
    profileFields: ['id', 'displayName', 'photos'],
    scope: ['instagram_basic', 'pages_show_list']
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const userData = {
        platform: 'instagram',
        platformId: profile.id,
        displayName: profile.displayName,
        profileImage: profile.photos?.[0]?.value,
        accessToken: accessToken,
        refreshToken: refreshToken,
        rawProfile: profile._json
      };
      
      const user = await createOrUpdateUser(userData);
      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }));

  // Serialize/Deserialize for session support
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await getUserById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });
}

module.exports = { configurePassport };