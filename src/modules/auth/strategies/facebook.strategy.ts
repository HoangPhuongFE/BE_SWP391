import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-facebook';
import { Request } from 'express';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor() {
    super({
      clientID: process.env.FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
      callbackURL:
        process.env.NODE_ENV === 'production'
          ? `${process.env.BACKEND_URL_PROD}/auth/facebook/redirect`
          : `${process.env.BACKEND_URL_LOCAL}/auth/facebook/redirect`,
      profileFields: ['id', 'emails', 'name', 'picture.type(large)'],
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: (err: any, user?: any) => void,
  ) {
    const { id, emails, name, photos } = profile;
    const user = {
      provider: 'facebook',
      providerId: id,
      email: emails?.[0]?.value,
      name: `${name?.givenName ?? ''} ${name?.familyName ?? ''}`.trim(),
      picture: photos?.[0]?.value,
    };
    done(null, user);
  }
}
