# Rate Limiting Implementation Guide

## Overview

Rate limiting has been implemented on authentication endpoints to prevent brute-force attacks and spam account creation.

## Configuration

### Login Rate Limit
- **Endpoint**: `POST /api/auth/login`
- **Limit**: 5 attempts per 15 minutes per IP address
- **Response**: 429 Too Many Requests with message "Too many authentication attempts, please try again later"

### Signup Rate Limit
- **Endpoint**: `POST /api/auth/signup`
- **Limit**: 10 attempts per hour per IP address
- **Response**: 429 Too Many Requests with message "Too many accounts created from this IP, please try again later"

## Implementation Details

Rate limiting is implemented using [express-rate-limit](https://github.com/nfriedly/express-rate-limit) middleware in `src/app.ts`:

```typescript
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,        // 15 minutes
  max: 5,                           // 5 attempts
  message: '...',                   // User-friendly message
  standardHeaders: true,            // Return RateLimit-* headers
  legacyHeaders: false,             // Don't return X-RateLimit-* headers
  skip: () => process.env.NODE_ENV === 'test', // Disabled in tests
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,         // 1 hour
  max: 10,                          // 10 attempts
  message: '...',
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});
```

## Usage in Routes

Applied to routes in `src/app.ts`:

```typescript
// Auth routes with rate limiting
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', signupLimiter);
app.use('/api/auth', authRoutes);
```

## Testing

Rate limiting is automatically **skipped in test environment** (`NODE_ENV=test`), allowing tests to make unlimited requests without hitting rate limits.

```bash
npm test  # Rate limiting skipped
npm run dev  # Rate limiting active
```

## Client-Side Handling

When rate limited (429 response):

```javascript
// Example: Handle rate limit in frontend
fetch('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify(credentials),
})
  .then(res => {
    if (res.status === 429) {
      // Show user friendly message
      showError('Too many login attempts. Please try again in 15 minutes.');
    }
    return res.json();
  });
```

Response headers include:
```
RateLimit-Limit: 5
RateLimit-Remaining: 3
RateLimit-Reset: 1715808900
```

Use `RateLimit-Remaining` to warn users before hitting limit:
```javascript
const remaining = parseInt(res.headers.get('RateLimit-Remaining'));
if (remaining < 2) {
  showWarning(`${remaining} attempts remaining before rate limit`);
}
```

## Customization

### Adjust Limits

Edit `src/app.ts`:

```typescript
// Stricter for production
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,  // 10 minutes (was 15)
  max: 3,                     // 3 attempts (was 5)
  // ...
});
```

### Per-User Limits

To rate limit by user ID instead of IP (when authenticated):

```typescript
const userLimiter = rateLimit({
  keyGenerator: (req, res) => req.user?.id || req.ip,
  windowMs: 60 * 60 * 1000,
  max: 100,
});
```

### Store Limits in Redis

For horizontal scaling across multiple servers:

```typescript
import RedisStore from 'rate-limit-redis';
import redis from 'redis';

const client = redis.createClient();

const authLimiter = rateLimit({
  store: new RedisStore({
    client: client,
    prefix: 'rl:',
  }),
  windowMs: 15 * 60 * 1000,
  max: 5,
});
```

## Monitoring

### Log Rate Limit Hits

```typescript
const authLimiter = rateLimit({
  // ... other options
  onLimitReached: (req, res, options) => {
    console.warn(`Rate limit reached for IP: ${req.ip}`);
  },
  handler: (req, res) => {
    console.warn(`Rate limit exceeded for ${req.method} ${req.path}`);
    res.status(options.statusCode).json({
      error: options.message,
    });
  },
});
```

### Metrics

Track rate limit hits:
```typescript
let rateLimitHits = 0;

app.use((req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode === 429) {
      rateLimitHits++;
    }
  });
  next();
});

app.get('/metrics', (req, res) => {
  res.json({ rateLimitHits });
});
```

## Security Considerations

### IP Spoofing
When behind a reverse proxy (Nginx, CloudFlare), configure Express to trust proxy:

```typescript
app.set('trust proxy', 1); // Trust first proxy (e.g., CloudFlare)
```

Otherwise, all requests appear from proxy IP and rate limiting won't work.

### DDoS Prevention
Rate limiting alone doesn't prevent DDoS. Additional measures:
- Use CloudFlare, AWS WAF, or similar
- Implement IP blacklisting
- Use Fail2Ban for OS-level blocking

### False Positives
Corporate networks may share IPs. Consider:
- Allowing whitelist of corporate IPs
- Using user ID as key (when authenticated)
- Longer windows for signup (1 hour vs 5 minutes)

## Bypass for Legitimate Use

For testing or maintenance:

```typescript
const bypassList = ['127.0.0.1', '192.168.1.1'];

const authLimiter = rateLimit({
  skip: (req) => 
    process.env.NODE_ENV === 'test' ||
    bypassList.includes(req.ip),
  // ... other options
});
```

## Migration Guide

### From No Rate Limiting
✅ Already implemented. No action needed.

### From Other Rate Limiter
1. Uninstall old package
2. Install `express-rate-limit`: Already done
3. Update middleware configuration
4. Test with `npm test`

## Troubleshooting

### "Rate limit not working"
1. Check `NODE_ENV` is not set to 'test'
2. Verify Express trusts proxy: `app.set('trust proxy', 1)`
3. Check rate limiter is applied before routes

### "Rate limiting too strict"
- Increase `max` or `windowMs`
- Use Redis store with distributed cache
- Implement per-user limits instead of per-IP

### "Rate limiting too lenient"
- Decrease `max` or `windowMs`
- Monitor with logging
- Adjust based on attack patterns

## References
- [express-rate-limit docs](https://github.com/nfriedly/express-rate-limit)
- [RFC 6585 - HTTP 429](https://tools.ietf.org/html/rfc6585)
- [OWASP Rate Limiting](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Prevention_Cheat_Sheet.html)
