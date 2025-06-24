import jwt from 'jsonwebtoken'
import type { Request, Response, NextFunction } from 'express'
import type { AuthUser } from '../types/index.js'

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

export interface AuthRequest extends Request {
  user?: AuthUser
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'No authorization header'
      })
      return
    }

    const token = authHeader.replace('Bearer ', '')
    const jwtSecret = process.env.JWT_SECRET

    if (!jwtSecret) {
      console.error('JWT_SECRET not configured')
      res.status(500).json({
        success: false,
        error: 'Server configuration error'
      })
      return
    }

    const decoded = jwt.verify(token, jwtSecret) as AuthUser
    
    if (!decoded || !decoded.id) {
      res.status(401).json({
        success: false,
        error: 'Invalid token'
      })
      return
    }

    req.user = decoded
    next()
  } catch (error) {
    console.error('Auth middleware error:', error)
    res.status(401).json({
      success: false,
      error: 'Authentication failed'
    })
  }
}

export function optionalAuthMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '')
      const jwtSecret = process.env.JWT_SECRET

      if (jwtSecret) {
        const decoded = jwt.verify(token, jwtSecret) as AuthUser
        if (decoded && decoded.id) {
          req.user = decoded
        }
      }
    }

    next()
  } catch (error) {
    // Continue without authentication for optional auth
    next()
  }
} 