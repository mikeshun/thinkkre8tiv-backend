import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from 'src/enum/role.enum';
import { ROLES_KEY } from 'src/enum/roles.decorator';



@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) { }

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    console.log('RolesGuard - Required roles:', requiredRoles);

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    console.log('RolesGuard - User:', user);

    if (!user) {
      throw new UnauthorizedException('Unauthorized: No user found.');
    }

    if (!user.role) {
      throw new UnauthorizedException('User role is missing.');
    }

    const hasRole = requiredRoles.some((role) =>
      user.role === role && Object.values(Role).includes(role)
    );

    console.log('RolesGuard - User role:', user.role);
    console.log('RolesGuard - Has required role:', hasRole);

    if (!hasRole) {
      throw new UnauthorizedException('User has no permission.');
    }

    return true;
  }
}