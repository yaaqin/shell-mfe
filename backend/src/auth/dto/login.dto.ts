import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  // Accepts either email or username
  @IsString()
  identifier!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
