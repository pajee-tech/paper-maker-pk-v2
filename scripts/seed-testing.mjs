/** Synthetic testing data only. Refuses to run against any DB not named papermaker_test. */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
const prisma = new PrismaClient();
const url = process.env.DATABASE_URL;
const password = process.env.DEMO_PASSWORD;
if (!url || new URL(url).pathname !== '/papermaker_test' || process.env.PM_TEST_DB_CONFIRM !== 'YES' || !password || password.length < 12) {
  console.error('Use a separate database named papermaker_test, PM_TEST_DB_CONFIRM=YES, and DEMO_PASSWORD (12+ characters).');
  process.exit(1);
}
const ids={school:'demo-school-pm2',admin:'demo-admin-pm2',cls:'demo-class-9-pm2',sub:'demo-math-pm2',chapter:'demo-chapter-pm2',book:'demo-book-pm2',included:'demo-chapter-1-pm2',excluded:'demo-chapter-2-pm2',exercise:'demo-exercise-pm2',version:'demo-alp-v1-pm2'};
const sig=q=>createHash('sha256').update(JSON.stringify([q.type,q.text,q.urduText??null,q.options??null,q.qNo??null,q.topic??null])).digest('hex');
try {
  await prisma.$transaction(async tx=>{
    await tx.institution.upsert({where:{id:ids.school},create:{id:ids.school,name:'DEMO — Testing School',type:'SCHOOL',plan:'PAPER_MAKER_PRO'},update:{}});
    await tx.user.upsert({where:{id:ids.admin},create:{id:ids.admin,institutionId:ids.school,name:'Demo Administrator',email:'demo-admin@example.test',passwordHash:await bcrypt.hash(password,12),role:'INSTITUTION_ADMIN'},update:{passwordHash:await bcrypt.hash(password,12)}});
    await tx.academicClass.upsert({where:{id:ids.cls},create:{id:ids.cls,name:'9th',level:'MATRIC',institutionId:ids.school},update:{}});
    await tx.subject.upsert({where:{id:ids.sub},create:{id:ids.sub,name:'Mathematics',classId:ids.cls},update:{}});
    await tx.chapter.upsert({where:{id:ids.chapter},create:{id:ids.chapter,number:1,title:'DEMO Algebra',subjectId:ids.sub,isAlp:true},update:{}});
    await tx.book.upsert({where:{id:ids.book},create:{id:ids.book,title:'DEMO ONLY — Mathematics sample bank',board:'TEST ONLY — not official',edition:'2026-27',level:'MATRIC',className:'9th',subjectName:'Mathematics',status:'READY',pageCount:2,institutionId:ids.school},update:{}});
    for(const [id,number,title,isAlp] of [[ids.included,1,'Included sample: algebra',true],[ids.excluded,2,'Excluded sample: geometry',false]]){
      await tx.bookChapter.upsert({where:{id},create:{id,bookId:ids.book,number,title,isAlp,startPage:number,endPage:number},update:{}});
      await tx.bookPage.upsert({where:{bookId_pageNo:{bookId:ids.book,pageNo:number}},create:{bookId:ids.book,pageNo:number,text:title,chapterId:id},update:{}});
    }
    await tx.bookExercise.upsert({where:{id:ids.exercise},create:{id:ids.exercise,chapterId:ids.included,title:'Exercise 1.1 — demonstration',startPage:1,endPage:1},update:{}});
    const entries=[];
    for(let n=1;n<=30;n++){
      const id=`demo-mcq-${n}`,q={id,bookId:ids.book,chapterId:ids.included,exerciseId:ids.exercise,qNo:String(n),type:'MCQ',text:`Solve $x+${n}=${n+2}$ for $x$.`,options:['1','2','3','4'],correctOption:1,marks:1};
      const row=await tx.bookItem.upsert({where:{id},create:q,update:{}});entries.push({id,signature:sig(row)});
    }
    for(let n=1;n<=45;n++){
      const id=`demo-short-${n}`,q={id,bookId:ids.book,chapterId:ids.included,exerciseId:ids.exercise,qNo:String(30+n),type:'SHORT',text:`Simplify $${n}x+2x$.`,answer:`$${n+2}x$`,marks:2};
      const row=await tx.bookItem.upsert({where:{id},create:q,update:{}});entries.push({id,signature:sig(row)});
    }
    for(let n=1;n<=20;n++){
      const id=`demo-long-${n}`,q={id,bookId:ids.book,chapterId:ids.included,exerciseId:ids.exercise,qNo:String(75+n),type:'LONG',text:`Solve $2x+${n}=${n+12}$ and verify your answer.`,answer:'$x=6$',marks:5};
      const row=await tx.bookItem.upsert({where:{id},create:q,update:{}});entries.push({id,signature:sig(row)});
    }
    await tx.bookItem.upsert({where:{id:'demo-excluded-q'},create:{id:'demo-excluded-q',bookId:ids.book,chapterId:ids.excluded,type:'SHORT',text:'DEMO EXCLUDED — Draw a circle.',marks:2},update:{}});
    await tx.smartSyllabusVersion.upsert({where:{id:ids.version},create:{id:ids.version,bookId:ids.book,title:'DEMO — Smart Syllabus',academicYear:'2026-27',sourceReference:'Synthetic test content; not an official board document',entries,questionCount:entries.length,createdById:ids.admin},update:{}});
    for(let n=1;n<=5;n++){
      const id=`demo-student-${n}`;
      await tx.student.upsert({where:{id},create:{id,institutionId:ids.school,admissionNo:`DEMO-${n}`,name:`Sample Student ${n}`},update:{}});
      await tx.studentEnrollment.upsert({where:{id:`demo-enroll-${n}`},create:{id:`demo-enroll-${n}`,studentId:id,classId:ids.cls,academicYear:'2026-27',section:'A',rollNo:String(n)},update:{}});
    }
    await tx.calendarEvent.upsert({where:{id:'demo-calendar-pm2'},create:{id:'demo-calendar-pm2',institutionId:ids.school,title:'DEMO — sample vacation',startDate:'2026-12-21',endDate:'2026-12-23',kind:'HOLIDAY'},update:{}});
  },{timeout:60000});
  console.log('Seed complete. Login: demo-admin@example.test / your DEMO_PASSWORD. Sample bank and syllabus are synthetic.');
} finally { await prisma.$disconnect(); }
