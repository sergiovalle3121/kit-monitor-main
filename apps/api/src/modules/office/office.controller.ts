import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UseGuards,
} from '@nestjs/common';
import { OfficeService } from './office.service';
import type { OfficeDocumentLifecycleState, OfficeDocType, OfficeShare } from './entities/office-document.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/jwt.types';
import { CreateOfficeCommentDto, ListOfficeCommentsQueryDto, ReplyOfficeCommentDto, UpdateOfficeCommentDto } from './dto/office-comment.dto';

interface AuthReq { user: AuthenticatedUser }

@UseGuards(JwtAuthGuard)
@Controller('office-documents')
export class OfficeController {
  constructor(private readonly service: OfficeService) {}

  @Get()
  list(
    @Request() req: AuthReq,
    @Query('type') type?: OfficeDocType,
    @Query('trash') trash?: string,
    @Query('q') q?: string,
    @Query('lifecycle') lifecycle?: OfficeDocumentLifecycleState,
    @Query('locked') locked?: string,
    @Query('owner') owner?: string,
    @Query('entity') entity?: string,
    @Query('refId') refId?: string,
    @Query('tag') tag?: string,
    @Query('space') space?: string,
    @Query('folderPath') folderPath?: string,
    @Query('collection') collection?: string,
    @Query('favorite') favorite?: string,
    @Query('pinned') pinned?: string,
  ) {
    return this.service.list(type, req.user, trash === '1' || trash === 'true', { q, lifecycle, locked, owner, entity, refId, tag, space, folderPath, collection, favorite, pinned });
  }


  @Get('impact')
  impact(@Request() req: AuthReq, @Query('entity') entity?: string, @Query('refId') refId?: string) {
    return this.service.impactAnalysis(req.user, entity, refId);
  }

  @Post('search-index/rebuild')
  rebuildSearchIndex(@Request() req: AuthReq) {
    return this.service.rebuildSearchIndex(req.user);
  }

  @Get('work-queue')
  workQueue(@Request() req: AuthReq) {
    return this.service.workQueue(req.user);
  }

  @Get(':id/search-index')
  searchIndex(@Request() req: AuthReq, @Param('id') id: string) {
    return this.service.searchMetadata(id, req.user);
  }

  @Get(':id')
  get(@Request() req: AuthReq, @Param('id') id: string) {
    return this.service.get(id, req.user);
  }

  @Post()
  create(@Request() req: AuthReq, @Body() dto: { type: OfficeDocType; title?: string; content?: any; model?: string; space?: string | null; folderPath?: string | null; collection?: string | null; tags?: string[] }) {
    return this.service.create(dto, req.user);
  }

  @Post(':id/duplicate')
  duplicate(@Request() req: AuthReq, @Param('id') id: string) {
    return this.service.duplicate(id, req.user);
  }

  @Post(':id/lifecycle/submit-review')
  submitReview(@Request() req: AuthReq, @Param('id') id: string, @Body() dto: { note?: string }) {
    return this.service.submitForReview(id, req.user, dto);
  }

  @Post(':id/lifecycle/approve')
  approve(@Request() req: AuthReq, @Param('id') id: string, @Body() dto: { note?: string }) {
    return this.service.approve(id, req.user, dto);
  }

  @Post(':id/lifecycle/release')
  release(@Request() req: AuthReq, @Param('id') id: string, @Body() dto: { note?: string }) {
    return this.service.release(id, req.user, dto);
  }

  @Post(':id/lifecycle/obsolete')
  obsolete(@Request() req: AuthReq, @Param('id') id: string, @Body() dto: { note?: string }) {
    return this.service.obsolete(id, req.user, dto);
  }

  @Post(':id/lifecycle/reopen-draft')
  reopenDraft(@Request() req: AuthReq, @Param('id') id: string, @Body() dto: { note?: string }) {
    return this.service.reopenDraft(id, req.user, dto);
  }

  @Patch(':id/periodic-review')
  periodicReview(
    @Request() req: AuthReq,
    @Param('id') id: string,
    @Body() dto: { nextReviewAt?: string | null; reviewIntervalDays?: number | null; reviewOwner?: string | null; note?: string | null },
  ) {
    return this.service.setPeriodicReview(id, dto, req.user);
  }

  @Post(':id/periodic-review/complete')
  completePeriodicReview(@Request() req: AuthReq, @Param('id') id: string, @Body() dto: { note?: string | null }) {
    return this.service.completePeriodicReview(id, dto, req.user);
  }

  @Patch(':id')
  update(
    @Request() req: AuthReq,
    @Param('id') id: string,
    @Body() dto: { title?: string; content?: any; model?: string | null; sharedWith?: OfficeShare[]; space?: string | null; folderPath?: string | null; collection?: string | null; tags?: string[]; favorite?: boolean; pinned?: boolean },
  ) {
    return this.service.update(id, dto, req.user);
  }

  @Patch(':id/restore')
  restore(@Request() req: AuthReq, @Param('id') id: string) {
    return this.service.restore(id, req.user);
  }






  @Get(':id/release-readiness')
  releaseReadiness(@Request() req: AuthReq, @Param('id') id: string) {
    return this.service.releaseReadiness(id, req.user);
  }

  @Get(':id/evidence-package')
  evidencePackage(@Request() req: AuthReq, @Param('id') id: string) {
    return this.service.evidencePackage(id, req.user);
  }

  @Get(':id/review-tasks')
  reviewTasks(@Request() req: AuthReq, @Param('id') id: string) {
    return this.service.listReviewTasks(id, req.user);
  }

  @Post(':id/review-tasks')
  assignReviewers(@Request() req: AuthReq, @Param('id') id: string, @Body() dto: { reviewers?: string[]; dueAt?: string | null; note?: string | null }) {
    return this.service.assignReviewTasks(id, dto, req.user);
  }

  @Post(':id/review-tasks/:taskId/decision')
  decideReviewTask(@Request() req: AuthReq, @Param('id') id: string, @Param('taskId') taskId: string, @Body() dto: { decision?: 'approved' | 'rejected'; note?: string | null }) {
    return this.service.decideReviewTask(id, taskId, dto, req.user);
  }

  @Post(':id/review-tasks/:taskId/cancel')
  cancelReviewTask(@Request() req: AuthReq, @Param('id') id: string, @Param('taskId') taskId: string) {
    return this.service.cancelReviewTask(id, taskId, req.user);
  }

  @Get(':id/training')
  trainingAssignments(@Request() req: AuthReq, @Param('id') id: string) {
    return this.service.listTrainingAssignments(id, req.user);
  }

  @Post(':id/training')
  assignTraining(@Request() req: AuthReq, @Param('id') id: string, @Body() dto: { assignees?: string[]; dueAt?: string | null; note?: string | null }) {
    return this.service.assignTraining(id, dto, req.user);
  }

  @Post(':id/training/:assignmentId/acknowledge')
  acknowledgeTraining(
    @Request() req: AuthReq,
    @Param('id') id: string,
    @Param('assignmentId') assignmentId: string,
    @Body() dto: { statement?: string; signerName?: string | null; signerRole?: string | null },
  ) {
    return this.service.acknowledgeTraining(id, assignmentId, dto, req.user);
  }

  @Post(':id/training/:assignmentId/cancel')
  cancelTraining(@Request() req: AuthReq, @Param('id') id: string, @Param('assignmentId') assignmentId: string) {
    return this.service.cancelTrainingAssignment(id, assignmentId, req.user);
  }

  @Get(':id/signatures')
  signatures(@Request() req: AuthReq, @Param('id') id: string) {
    return this.service.listSignatures(id, req.user);
  }

  @Post(':id/signatures')
  signDocument(
    @Request() req: AuthReq,
    @Param('id') id: string,
    @Body() dto: { meaning?: 'reviewed' | 'approved' | 'released' | 'acknowledged' | 'training_ack'; statement?: string; signerName?: string | null; signerRole?: string | null; metadata?: Record<string, unknown> | null },
  ) {
    return this.service.signDocument(id, dto, req.user);
  }

  @Get(':id/signatures/:signatureId/verify')
  verifySignature(@Request() req: AuthReq, @Param('id') id: string, @Param('signatureId') signatureId: string) {
    return this.service.verifySignature(id, signatureId, req.user);
  }

  @Post(':id/signatures/:signatureId/revoke')
  revokeSignature(@Request() req: AuthReq, @Param('id') id: string, @Param('signatureId') signatureId: string) {
    return this.service.revokeSignature(id, signatureId, req.user);
  }

  @Get(':id/distributions')
  distributions(@Request() req: AuthReq, @Param('id') id: string) {
    return this.service.listDistributions(id, req.user);
  }

  @Get(':id/distributions/:copyNo/verify')
  verifyDistribution(
    @Request() req: AuthReq,
    @Param('id') id: string,
    @Param('copyNo') copyNo: string,
    @Query('code') code?: string,
  ) {
    return this.service.verifyDistribution(id, copyNo, code, req.user);
  }

  @Post(':id/distributions')
  recordDistribution(
    @Request() req: AuthReq,
    @Param('id') id: string,
    @Body() dto: { action?: 'export' | 'print' | 'download' | 'controlled_copy'; format?: 'pdf' | 'docx' | 'html' | 'markdown' | 'txt' | 'print' | 'other'; recipient?: string | null; purpose?: string | null; metadata?: Record<string, unknown> | null },
  ) {
    return this.service.recordDistribution(id, dto, req.user);
  }

  @Get(':id/comments')
  comments(@Request() req: AuthReq, @Param('id') id: string, @Query() query: ListOfficeCommentsQueryDto) {
    return this.service.listComments(id, req.user, query);
  }

  @Post(':id/comments')
  createComment(@Request() req: AuthReq, @Param('id') id: string, @Body() dto: CreateOfficeCommentDto) {
    return this.service.createComment(id, dto, req.user);
  }

  @Patch(':id/comments/:commentId')
  updateComment(@Request() req: AuthReq, @Param('id') id: string, @Param('commentId') commentId: string, @Body() dto: UpdateOfficeCommentDto) {
    return this.service.updateComment(id, commentId, dto, req.user);
  }

  @Post(':id/comments/:commentId/replies')
  replyComment(@Request() req: AuthReq, @Param('id') id: string, @Param('commentId') commentId: string, @Body() dto: ReplyOfficeCommentDto) {
    return this.service.replyToComment(id, commentId, dto, req.user);
  }

  @Delete(':id/comments/:commentId')
  deleteComment(@Request() req: AuthReq, @Param('id') id: string, @Param('commentId') commentId: string) {
    return this.service.deleteComment(id, commentId, req.user);
  }

  @Get(':id/timeline')
  timeline(@Request() req: AuthReq, @Param('id') id: string) {
    return this.service.timeline(id, req.user);
  }

  @Get(':id/versions')
  versions(@Request() req: AuthReq, @Param('id') id: string) {
    return this.service.listVersions(id, req.user);
  }

  @Post(':id/versions')
  snapshot(@Request() req: AuthReq, @Param('id') id: string, @Body() dto: { label?: string }) {
    return this.service.snapshotNow(id, req.user, dto?.label);
  }

  @Post(':id/versions/:versionId/restore')
  restoreVersion(@Request() req: AuthReq, @Param('id') id: string, @Param('versionId') versionId: string) {
    return this.service.restoreVersion(id, versionId, req.user);
  }

  @Delete(':id')
  remove(@Request() req: AuthReq, @Param('id') id: string) {
    return this.service.remove(id, req.user);
  }

  @Delete(':id/permanent')
  destroy(@Request() req: AuthReq, @Param('id') id: string) {
    return this.service.destroy(id, req.user);
  }
}
