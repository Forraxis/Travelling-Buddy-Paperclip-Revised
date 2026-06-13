import type {
  IServerAdapter,
  BullBoardQueues,
  UIConfig,
  AppControllerRoute,
  AppViewRoute,
  ControllerHandlerReturnType,
} from '@bull-board/api/typings/app';
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

type ErrorHandler = (error: Error) => ControllerHandlerReturnType;

interface RouteEntry {
  methods: string[];
  pattern: RegExp;
  paramNames: string[];
  handler: AppControllerRoute['handler'];
}

function routeToRegex(route: string): {
  pattern: RegExp;
  paramNames: string[];
} {
  const paramNames: string[] = [];
  const regexStr = route
    .replace(/:([^/]+)/g, (_match, name) => {
      paramNames.push(name);
      return '([^/]+)';
    })
    .replace(/\//g, '\\/');
  return { pattern: new RegExp(`^${regexStr}$`), paramNames };
}

export class NextJsServerAdapter implements IServerAdapter {
  private bullBoardQueues!: BullBoardQueues;
  private viewsPath!: string;
  private staticPath?: { route: string; fsPath: string };
  private uiConfig: UIConfig = {};
  private entryRoute?: AppViewRoute;
  private errorHandler?: ErrorHandler;
  private apiRoutes: RouteEntry[] = [];
  private basePath = '';

  setBasePath(p: string): this {
    this.basePath = p;
    return this;
  }

  setQueues(bullBoardQueues: BullBoardQueues): this {
    this.bullBoardQueues = bullBoardQueues;
    return this;
  }

  setViewsPath(viewPath: string): this {
    this.viewsPath = viewPath;
    return this;
  }

  setStaticPath(staticsRoute: string, staticsPath: string): this {
    this.staticPath = { route: staticsRoute, fsPath: staticsPath };
    return this;
  }

  setEntryRoute(route: AppViewRoute): this {
    this.entryRoute = route;
    return this;
  }

  setErrorHandler(handler: ErrorHandler): this {
    this.errorHandler = handler;
    return this;
  }

  setApiRoutes(routes: AppControllerRoute[]): this {
    for (const route of routes) {
      const methods = Array.isArray(route.method)
        ? route.method.map((m) => m.toUpperCase())
        : [route.method.toUpperCase()];
      const routePaths = Array.isArray(route.route)
        ? route.route
        : [route.route];
      for (const routePath of routePaths) {
        const { pattern, paramNames } = routeToRegex(routePath);
        this.apiRoutes.push({
          methods,
          pattern,
          paramNames,
          handler: route.handler,
        });
      }
    }
    return this;
  }

  setUIConfig(config: UIConfig = {}): this {
    this.uiConfig = config;
    return this;
  }

  async handleRequest(req: NextRequest, slug: string[]): Promise<NextResponse> {
    const subPath = '/' + (slug ?? []).join('/');

    // Serve static files
    if (this.staticPath && subPath.startsWith(this.staticPath.route)) {
      const relativePath = subPath.slice(this.staticPath.route.length);
      const filePath = path.join(this.staticPath.fsPath, relativePath);
      try {
        const data = fs.readFileSync(filePath);
        const ext = path.extname(filePath).slice(1);
        const mimeTypes: Record<string, string> = {
          js: 'application/javascript',
          css: 'text/css',
          svg: 'image/svg+xml',
          png: 'image/png',
          ico: 'image/x-icon',
        };
        return new NextResponse(data, {
          headers: {
            'Content-Type': mimeTypes[ext] ?? 'application/octet-stream',
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        });
      } catch {
        return new NextResponse('Not found', { status: 404 });
      }
    }

    // Handle API routes
    const method = req.method.toUpperCase();
    for (const entry of this.apiRoutes) {
      if (!entry.methods.includes(method)) continue;
      const match = subPath.match(entry.pattern);
      if (!match) continue;

      const params: Record<string, string> = {};
      entry.paramNames.forEach((name, i) => {
        params[name] = match[i + 1];
      });

      const url = new URL(req.url);
      const query: Record<string, string> = {};
      url.searchParams.forEach((v, k) => {
        query[k] = v;
      });

      let body: Record<string, unknown> = {};
      if (method !== 'GET' && method !== 'HEAD') {
        try {
          body = await req.json();
        } catch {
          body = {};
        }
      }

      const headers: Record<string, string | undefined> = {};
      req.headers.forEach((v, k) => {
        headers[k] = v;
      });

      try {
        const result = await entry.handler({
          queues: this.bullBoardQueues,
          uiConfig: this.uiConfig,
          query,
          params,
          body,
          headers,
        });
        return NextResponse.json(result.body, { status: result.status ?? 200 });
      } catch (err) {
        if (this.errorHandler) {
          const errResult = this.errorHandler(err as Error);
          return NextResponse.json(errResult.body, {
            status: errResult.status ?? 500,
          });
        }
        return NextResponse.json({ error: String(err) }, { status: 500 });
      }
    }

    // Entry point (HTML)
    if (
      this.entryRoute &&
      (method === 'GET' || method === 'HEAD') &&
      this.viewsPath
    ) {
      const entryPaths = Array.isArray(this.entryRoute.route)
        ? this.entryRoute.route
        : [this.entryRoute.route];
      const entryPatterns = entryPaths.map((r) => routeToRegex(r));
      const isEntryPath = entryPatterns.some(({ pattern }) =>
        subPath.match(pattern),
      );

      if (isEntryPath || subPath === '/') {
        const result = this.entryRoute.handler({
          basePath: this.basePath.endsWith('/')
            ? this.basePath
            : `${this.basePath}/`,
          uiConfig: this.uiConfig,
        });
        const ejsPath = path.join(this.viewsPath, `${result.name}`);
        try {
          let html = fs.readFileSync(ejsPath, 'utf8');
          // Simple EJS variable substitution (bull-board template is minimal)
          for (const [key, val] of Object.entries(result.params)) {
            html = html.replace(new RegExp(`<%= ${key} %>`, 'g'), val ?? '');
            html = html.replace(new RegExp(`<%- ${key} %>`, 'g'), val ?? '');
          }
          return new NextResponse(html, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          });
        } catch {
          return new NextResponse('Bull Board UI not available', {
            status: 500,
          });
        }
      }
    }

    return new NextResponse('Not found', { status: 404 });
  }
}
