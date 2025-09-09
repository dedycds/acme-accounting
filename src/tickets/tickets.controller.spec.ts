import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Company } from '../../db/models/Company';
import {
  TicketCategory,
  TicketStatus,
  TicketType,
  Ticket,
} from '../../db/models/Ticket';
import { User, UserRole } from '../../db/models/User';
import { DbModule } from '../db.module';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

describe('TicketsController', () => {
  let controller: TicketsController;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      controllers: [TicketsController],
      providers: [TicketsService],
      imports: [DbModule],
    }).compile();

    controller = module.get<TicketsController>(TicketsController);
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }
  });

  it('should be defined', async () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    describe('managementReport', () => {
      it('creates managementReport ticket', async () => {
        const company = await Company.create({ name: 'test' });
        const user = await User.create({
          name: 'Test User',
          role: UserRole.accountant,
          companyId: company.id,
        });

        const ticket = await controller.create({
          companyId: company.id,
          type: TicketType.managementReport,
        });

        expect(ticket.category).toBe(TicketCategory.accounting);
        expect(ticket.assigneeId).toBe(user.id);
        expect(ticket.status).toBe(TicketStatus.open);
      });

      it('if there are multiple accountants, assign the last one', async () => {
        const company = await Company.create({ name: 'test' });
        await User.create({
          name: 'Test User',
          role: UserRole.accountant,
          companyId: company.id,
        });
        const user2 = await User.create({
          name: 'Test User',
          role: UserRole.accountant,
          companyId: company.id,
        });

        const ticket = await controller.create({
          companyId: company.id,
          type: TicketType.managementReport,
        });

        expect(ticket.category).toBe(TicketCategory.accounting);
        expect(ticket.assigneeId).toBe(user2.id);
        expect(ticket.status).toBe(TicketStatus.open);
      });

      it('if there is no accountant, throw', async () => {
        const company = await Company.create({ name: 'test' });

        await expect(
          controller.create({
            companyId: company.id,
            type: TicketType.managementReport,
          }),
        ).rejects.toEqual(
          new ConflictException(
            `Cannot find user with role accountant to create a ticket`,
          ),
        );
      });
    });

    describe('registrationAddressChange', () => {
      it('creates registrationAddressChange ticket', async () => {
        const company = await Company.create({ name: 'test' });
        const user = await User.create({
          name: 'Test User',
          role: UserRole.corporateSecretary,
          companyId: company.id,
        });

        const ticket = await controller.create({
          companyId: company.id,
          type: TicketType.registrationAddressChange,
        });

        expect(ticket.category).toBe(TicketCategory.corporate);
        expect(ticket.assigneeId).toBe(user.id);
        expect(ticket.status).toBe(TicketStatus.open);
      });

      it('if there are multiple secretaries, throw', async () => {
        const company = await Company.create({ name: 'test' });
        await User.create({
          name: 'Test User',
          role: UserRole.corporateSecretary,
          companyId: company.id,
        });
        await User.create({
          name: 'Test User',
          role: UserRole.corporateSecretary,
          companyId: company.id,
        });

        await expect(
          controller.create({
            companyId: company.id,
            type: TicketType.registrationAddressChange,
          }),
        ).rejects.toEqual(
          new ConflictException(
            `Multiple users with role corporateSecretary. Cannot create a ticket`,
          ),
        );
      });

      it('if there are multiple directors, throw', async () => {
        const company = await Company.create({ name: 'test' });
        await User.create({
          name: 'Test User',
          role: UserRole.director,
          companyId: company.id,
        });
        await User.create({
          name: 'Test User',
          role: UserRole.director,
          companyId: company.id,
        });

        await expect(
          controller.create({
            companyId: company.id,
            type: TicketType.registrationAddressChange,
          }),
        ).rejects.toEqual(
          new ConflictException(
            `Multiple users with role director. Cannot create a ticket`,
          ),
        );
      });

      it('if there is no secretary, fallback to director', async () => {
        const company = await Company.create({ name: 'test' });
        const user = await User.create({
          name: 'Test Director',
          role: UserRole.director,
          companyId: company.id,
        });

        const ticket = await controller.create({
          companyId: company.id,
          type: TicketType.registrationAddressChange,
        });

        expect(ticket.category).toBe(TicketCategory.corporate);
        expect(ticket.assigneeId).toBe(user.id);
        expect(ticket.status).toBe(TicketStatus.open);
      });

      it('if there is no secretary and no director, throw', async () => {
        const company = await Company.create({ name: 'test' });

        await expect(
          controller.create({
            companyId: company.id,
            type: TicketType.registrationAddressChange,
          }),
        ).rejects.toEqual(
          new ConflictException(
            `Cannot find user with role director to create a ticket`,
          ),
        );
      });

      it('if there is existing ticket, throw', async () => {
        const company = await Company.create({ name: 'test' });
        const user = await User.create({
          name: 'Test User',
          role: UserRole.corporateSecretary,
          companyId: company.id,
        });
        await Ticket.create({
          companyId: company.id,
          type: TicketType.registrationAddressChange,
          assigneeId: user.id,
          status: TicketStatus.open
        });

        await expect(
          controller.create({
            companyId: company.id,
            type: TicketType.registrationAddressChange,
          }),
        ).rejects.toEqual(
          new ConflictException(
            `Ticket with type registrationAddressChange already exists`,
          ),
        );
      });
    });

    describe('strikeOff', () => {
      it('creates strikeOff ticket', async () => {
        const company = await Company.create({ name: 'test' });
        const user = await User.create({
          name: 'Test User',
          role: UserRole.director,
          companyId: company.id,
        });
        const ticket = await controller.create({
          companyId: company.id,
          type: TicketType.strikeOff,
        });

        expect(ticket.category).toBe(TicketCategory.management);
        expect(ticket.assigneeId).toBe(user.id);
        expect(ticket.status).toBe(TicketStatus.open);
      });

      it('if there are multiple directors, throw', async () => {
        const company = await Company.create({ name: 'test' });
        await User.create({
          name: 'Test User',
          role: UserRole.director,
          companyId: company.id,
        });
        await User.create({
          name: 'Test User',
          role: UserRole.director,
          companyId: company.id,
        });

        await expect(
          controller.create({
            companyId: company.id,
            type: TicketType.strikeOff,
          }),
        ).rejects.toEqual(
          new ConflictException(
            `Multiple users with role director. Cannot create a ticket`,
          ),
        );
      });

      it('resolved other open tickets', async () => {
        const company = await Company.create({ name: 'test' });
        await User.create({
          name: 'Test User',
          role: UserRole.director,
          companyId: company.id,
        });
        const secretaries = await User.create({
          name: 'Test User',
          role: UserRole.corporateSecretary,
          companyId: company.id,
        });
        const accountant = await User.create({
          name: 'Test User',
          role: UserRole.accountant,
          companyId: company.id,
        });

        await Ticket.create({
          companyId: company.id,
          assigneeId: accountant.id,
          category: TicketCategory.accounting,
          type: TicketType.managementReport,
          status: TicketStatus.open,
        });

        await Ticket.create({
          companyId: company.id,
          assigneeId: secretaries.id,
          category: TicketCategory.corporate,
          type: TicketType.registrationAddressChange,
          status: TicketStatus.open,
        });

        const ticket = await controller.create({
          companyId: company.id,
          type: TicketType.strikeOff,
        });

        const allTickets = await Ticket.findAll();
        const allOpen = allTickets.filter(
          (ticket) => ticket.status === TicketStatus.open,
        );
        const allReolved = allTickets.filter(
          (ticket) => ticket.status === TicketStatus.resolved,
        );

        expect(allOpen.length).toBe(1);
        expect(allOpen[0].id).toBe(ticket.id);
        expect(allReolved.length).toBe(2);
      });
    });
  });
});
