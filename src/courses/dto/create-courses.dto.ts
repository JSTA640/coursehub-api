import { IsIn, IsNotEmpty, IsString,  } from 'class-validator';

export class createcourseDto {
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsIn(['beginner', 'intermediate', 'advanced'])
    level: string;
}
