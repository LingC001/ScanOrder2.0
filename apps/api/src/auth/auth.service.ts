import {
  Inject,
  Injectable,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request, Response } from 'express';
import { MoreThan } from 'typeorm';
import type { Repository } from 'typeorm';
import type { AuthStatus } from '@scanorder/contracts';
import { APP_CONFIG } from '../config/app-config.module.js';
import type { AppConfig } from '../config/index.js';
import { SessionEntity } from './entities/session.entity.js';
import type { SessionKind } from './entities/session.entity.js';
import { verifyPassword } from './password.js';

export interface AuthPrincipal {
  kind: SessionKind;
  id: string;
  displayName: string;
  tokenHash: string;
}

export interface AuthenticatedRequest extends Request {
  auth?: AuthPrincipal;
}

const SESSION_HOURS = 12;
const MAX_FAILURES = 5;
const FAILURE_WINDOW_MS = 10 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly attempts = new Map<string, { count: number; resetAt: number }>();

  constructor(
    @InjectRepository(SessionEntity) private readonly sessions: Repository<SessionEntity>,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async merchantStatus(request: Request): Promise<AuthStatus> {
    const principal = await this.resolve(request, 'merchant');
    return {
      enabled: true,
      authenticated: Boolean(principal),
      displayName: principal?.displayName ?? null,
    };
  }

  async customerStatus(request: Request): Promise<AuthStatus> {
    const principal = await this.resolve(request, 'customer');
    return {
      enabled: this.config.customerLoginEnabled,
      authenticated: Boolean(principal),
      displayName: principal?.displayName ?? null,
    };
  }

  async loginMerchant(
    username: string,
    password: string,
    request: Request,
    response: Response,
  ): Promise<AuthStatus> {
    const key = `${request.ip || request.socket.remoteAddress || 'unknown'}:${username.toLowerCase()}`;
    this.ensureAllowed(key);
    const valid =
      username === this.config.adminUsername &&
      verifyPassword(password, this.config.adminPasswordHash);
    if (!valid) {
      this.fail(key);
      throw new UnauthorizedException('账号或密码不正确');
    }
    this.attempts.delete(key);
    await this.openSession('merchant', this.config.adminUsername, request, response);
    return this.merchantStatus(request);
  }

  async loginCustomer(request: Request, response: Response): Promise<AuthStatus> {
    if (!this.config.customerLoginEnabled) throw new UnauthorizedException('顾客登录入口未开启');
    await this.openSession('customer', this.config.customerAccountId, request, response);
    return this.customerStatus(request);
  }

  async logout(kind: SessionKind, request: Request, response: Response): Promise<void> {
    const token = this.readCookie(request, this.cookieName(kind));
    if (token) await this.sessions.delete({ tokenHash: this.hash(token) });
    response.clearCookie(this.cookieName(kind), this.cookieOptions());
  }

  async resolve(request: Request, kind: SessionKind): Promise<AuthPrincipal | null> {
    const token = this.readCookie(request, this.cookieName(kind));
    if (!token) return null;
    const tokenHash = this.hash(token);
    const session = await this.sessions.findOneBy({
      tokenHash,
      kind,
      expiresAt: MoreThan(new Date()),
    });
    if (!session) return null;
    return {
      kind,
      id: session.principalId,
      displayName:
        kind === 'merchant' ? this.config.adminUsername : this.config.customerAccountName,
      tokenHash,
    };
  }

  private async openSession(
    kind: SessionKind,
    principalId: string,
    request: Request,
    response: Response,
  ): Promise<void> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
    await this.sessions.save({
      id: randomUUID(),
      tokenHash: this.hash(token),
      kind,
      principalId,
      expiresAt,
    });
    response.cookie(this.cookieName(kind), token, {
      ...this.cookieOptions(),
      maxAge: SESSION_HOURS * 60 * 60 * 1000,
    });
    request.headers.cookie = [
      request.headers.cookie,
      `${this.cookieName(kind)}=${encodeURIComponent(token)}`,
    ]
      .filter(Boolean)
      .join('; ');
  }

  private ensureAllowed(key: string): void {
    const attempt = this.attempts.get(key);
    if (!attempt) return;
    if (attempt.resetAt <= Date.now()) {
      this.attempts.delete(key);
      return;
    }
    if (attempt.count >= MAX_FAILURES)
      throw new HttpException('登录失败次数过多，请稍后再试', HttpStatus.TOO_MANY_REQUESTS);
  }

  private fail(key: string): void {
    const now = Date.now();
    const attempt = this.attempts.get(key);
    if (!attempt || attempt.resetAt <= now) {
      this.attempts.set(key, { count: 1, resetAt: now + FAILURE_WINDOW_MS });
      return;
    }
    attempt.count += 1;
  }

  private cookieName(kind: SessionKind): string {
    return `scanorder_${kind}`;
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      sameSite: 'strict' as const,
      secure: this.config.secureCookies,
      path: '/',
    };
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private readCookie(request: Request, name: string): string | null {
    const cookies = request.headers.cookie?.split(';') ?? [];
    for (const item of cookies) {
      const [key, ...rest] = item.trim().split('=');
      if (key === name) {
        try {
          return decodeURIComponent(rest.join('='));
        } catch {
          return null;
        }
      }
    }
    return null;
  }
}
