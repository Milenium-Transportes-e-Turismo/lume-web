import type { WhatsAppConversationRepository } from '../contracts';

export function getWhatsAppServiceAssignmentTargets(repository: WhatsAppConversationRepository) {
  return repository.getServiceAssignmentTargets();
}
