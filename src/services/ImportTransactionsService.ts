import { getCustomRepository, getRepository, In } from 'typeorm';
import csvParse from 'csv-parse';
import fs from 'fs';

import TransactionRepository from '../repositories/TransactionsRepository';

import Transaction from '../models/Transaction';
import Category from '../models/Category';

type CSVTransaction = {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
};

class ImportTransactionsService {
  async loadFile(filePath: string): Promise<Transaction[]> {
    const transactionRepository = getCustomRepository(TransactionRepository);
    const categoriesRepository = getRepository(Category);

    const contactsCSVStream = fs.createReadStream(filePath);

    const parseStream = csvParse({
      from_line: 2,
    });

    const parseCSV = contactsCSVStream.pipe(parseStream);

    const transactions: CSVTransaction[] = [];
    const categories: string[] = [];

    parseCSV.on('data', async line => {
      const [title, type, value, category] = line.map((cell: string) =>
        cell.trim(),
      );

      if (!title || !type || !value) return;

      categories.push(category);

      transactions.push({ title, type, value, category });
    });

    await new Promise(resolve => {
      parseCSV.on('end', resolve);
    });

    const existentCategories = await categoriesRepository.find({
      where: {
        title: In(categories),
      },
    });

    const existentCategoriesTitles = existentCategories.map(
      (category: Category) => category.title,
    );

    const addCategoryTitles = categories
      .filter(category => !existentCategoriesTitles.includes(category))
      .filter((value, index, self) => self.indexOf(value) === index);

    const newCategories = categoriesRepository.create(
      addCategoryTitles.map(title => ({
        title,
      })),
    );

    await categoriesRepository.save(newCategories);

    const finalCategories = [...newCategories, ...existentCategories];

    const createdTransaction = transactionRepository.create(
      transactions.map(transaction => ({
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category: finalCategories.find(
          category => category.title === transaction.category,
        ),
      })),
    );

    await transactionRepository.save(createdTransaction);

    await fs.promises.unlink(filePath);

    return createdTransaction;
  }

  // async execute(filePath: string): Promise<Transaction[]> {
  //   const createTransactionService = new CreateTransactionService();

  //   const readCSVStream = fs.createReadStream(filePath);

  //   const parseStream = csvParse({
  //     from_line: 2,
  //     ltrim: true,
  //     rtrim: true,
  //   });

  //   const parseCSV = readCSVStream.pipe(parseStream);

  //   const lines: TransactionCsv[] = [];

  //   await parseCSV.on('data', async line => {
  //     const title = line[0];
  //     const type = line[1];
  //     const value = Number(line[2]);
  //     const category = line[3];
  //     if (!title || !type || !value || !category) return;
  //     lines.push({
  //       title,
  //       type,
  //       value,
  //       category,
  //     });
  //   });

  //   await new Promise(resolve => {
  //     parseCSV.on('end', resolve);
  //   });

  //   const transactions: Transaction[] = [];

  //   await lines.forEach(async transaction => {
  //     const { title, type, value, category } = transaction;
  //     const transactionSaved = await createTransactionService.execute({
  //       title,
  //       type,
  //       value,
  //       category,
  //     });
  //     console.log(transactionSaved);

  //     // transactions.push(transactionSaved);
  //   });

  //   return transactions;
  // }
}

export default ImportTransactionsService;
