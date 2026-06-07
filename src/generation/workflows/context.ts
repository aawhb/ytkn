import type { YouTubeService } from '../../youtube/youtubeService';
import type { NoteTargetWriter } from '../targets/noteTargets';

export interface GenerationWorkflowContext {
	youtubeService: YouTubeService;
	targets: NoteTargetWriter;
	onStatusBar(message: string | null): void;
}
